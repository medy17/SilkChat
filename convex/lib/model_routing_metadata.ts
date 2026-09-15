import type {
    ModelRoutingMetadata,
    ModelRoutingSummary,
    RoutingEndpoint
} from "../schema/model_routing"

const object = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined

export const parseNonNegativePrice = (value: unknown): number | undefined => {
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export const pricePerMillion = (value: unknown) => {
    const price = parseNonNegativePrice(value)
    return price === undefined ? undefined : Math.round(price * 1e12) / 1e6
}

export const endpointKey = (modelId: string, tag: string) => `${modelId}\n${tag}`

export const parseZdrEndpointKeys = (payload: unknown) => {
    const rows = object(payload)?.data
    if (!Array.isArray(rows)) throw new Error("Invalid OpenRouter ZDR endpoint listing")
    return new Set(
        rows.map((row) => {
            const endpoint = object(row)
            if (typeof endpoint?.model_id !== "string" || typeof endpoint.tag !== "string") {
                throw new Error("Invalid OpenRouter ZDR endpoint identity")
            }
            return endpointKey(endpoint.model_id, endpoint.tag)
        })
    )
}

export const parseRoutingEndpoints = (
    payload: unknown,
    modelId: string,
    zdrKeys?: Set<string>
): RoutingEndpoint[] => {
    const rows = object(object(payload)?.data)?.endpoints
    if (!Array.isArray(rows)) throw new Error("Invalid OpenRouter model endpoint listing")
    return rows.map((row) => {
        const endpoint = object(row)
        if (typeof endpoint?.tag !== "string" || !endpoint.tag)
            throw new Error("Invalid OpenRouter endpoint identity")
        const price = object(endpoint.pricing)
        const positive = (value: unknown) => {
            const parsed = parseNonNegativePrice(value)
            return parsed && parsed > 0 ? parsed : undefined
        }
        return {
            tag: endpoint.tag,
            providerName:
                typeof endpoint.provider_name === "string" ? endpoint.provider_name : endpoint.tag,
            pricing: {
                inputUsdPer1MTokens: pricePerMillion(price?.prompt),
                outputUsdPer1MTokens: pricePerMillion(price?.completion),
                cacheReadUsdPer1MTokens: pricePerMillion(price?.input_cache_read),
                cacheWriteUsdPer1MTokens: pricePerMillion(price?.input_cache_write),
                requestUsd: parseNonNegativePrice(price?.request)
            },
            contextLength: positive(endpoint.context_length),
            maxCompletionTokens: positive(endpoint.max_completion_tokens),
            supportedParameters: Array.isArray(endpoint.supported_parameters)
                ? endpoint.supported_parameters.filter((p): p is string => typeof p === "string")
                : undefined,
            zdr: zdrKeys ? zdrKeys.has(endpointKey(modelId, endpoint.tag)) : undefined
        }
    })
}

const matchesProvider = (tag: string, provider: string) =>
    tag === provider || tag.startsWith(`${provider}/`)
const tier = (tag: string) => /\/(flex|fast|priority)$/.exec(tag)?.[1]

export const summarizeRoutingEndpoints = (
    endpoints: RoutingEndpoint[],
    fetchedAt: number,
    preferences: string[] = []
): ModelRoutingSummary => {
    // Use a real endpoint's paired rates, never a synthetic mix of two providers.
    // This is a representative estimate; actual usage and caching determine the bill.
    const priced = endpoints.filter(
        (e) =>
            e.pricing.inputUsdPer1MTokens !== undefined &&
            e.pricing.outputUsdPer1MTokens !== undefined
    )
    const rank = (endpoint: RoutingEndpoint) => {
        const index = preferences.findIndex((provider) => matchesProvider(endpoint.tag, provider))
        return index < 0 ? preferences.length : index
    }
    priced.sort(
        (a, b) =>
            rank(a) - rank(b) ||
            a.pricing.inputUsdPer1MTokens! +
                a.pricing.outputUsdPer1MTokens! -
                (b.pricing.inputUsdPer1MTokens! + b.pricing.outputUsdPer1MTokens!) ||
            a.tag.localeCompare(b.tag)
    )
    return {
        available: endpoints.length > 0,
        contextLength: Math.max(0, ...endpoints.map((e) => e.contextLength ?? 0)) || undefined,
        maxCompletionTokens:
            Math.max(0, ...endpoints.map((e) => e.maxCompletionTokens ?? 0)) || undefined,
        pricing: priced[0]?.pricing,
        pricingEndpoint: priced[0]?.tag,
        fetchedAt
    }
}

/**
 * Keep endpoint listings as sync-time inputs. Older rows may still contain them, so compact
 * metadata at persistence and response boundaries until those rows have been rewritten.
 */
export const compactRoutingMetadata = (
    routing: ModelRoutingMetadata | undefined
): ModelRoutingMetadata | undefined => {
    if (!routing) return undefined

    return Object.fromEntries(
        Object.entries(routing).flatMap(([mode, summary]) => {
            if (!summary) return []
            const { endpoints: _endpoints, ...compactSummary } = summary
            return [[mode, compactSummary]]
        })
    ) as ModelRoutingMetadata
}

export const buildRoutingMetadata = (
    endpoints: RoutingEndpoint[],
    fetchedAt: number,
    preferences: string[] = [],
    hasZdrSnapshot = true
): ModelRoutingMetadata => {
    const standard = endpoints.filter((e) => !tier(e.tag))
    const curated = endpoints.filter((e) => !tier(e.tag) || preferences.some((p) => p === e.tag))
    return {
        silkchat: summarizeRoutingEndpoints(curated, fetchedAt, preferences),
        floor: summarizeRoutingEndpoints(
            endpoints.filter((e) => !tier(e.tag) || tier(e.tag) === "flex"),
            fetchedAt
        ),
        ...(hasZdrSnapshot
            ? {
                  zdr: summarizeRoutingEndpoints(
                      standard.filter((e) => e.zdr),
                      fetchedAt
                  )
              }
            : {})
    }
}
