"use node"

import type { Infer } from "convex/values"
import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"
import { MODELS_SHARED, getOpenRouterProviderModelId } from "./lib/models"
import type { ModelProviderMetadata } from "./schema/model_provider_metadata"

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

type OpenRouterModel = {
    id?: unknown
    context_length?: unknown
    knowledge_cutoff?: unknown
    pricing?: {
        prompt?: unknown
        completion?: unknown
    }
    top_provider?: {
        max_completion_tokens?: unknown
    }
}

type OpenRouterEndpoint = Pick<OpenRouterModel, "pricing"> & { tag?: unknown }

type NormalizedOpenRouterModel = Infer<typeof ModelProviderMetadata>

const parsePositiveNumber = (value: unknown) => {
    const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const pricePerTokenToPerMillion = (value: unknown) => {
    const parsed = parsePositiveNumber(value)
    return parsed === undefined ? undefined : Math.round(parsed * 1_000_000_000_000) / 1_000_000
}

const parseKnowledgeCutoff = (value: unknown) => {
    if (typeof value !== "string") return undefined

    const cutoff = value.trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(cutoff) ? cutoff : undefined
}

const normalizeOpenRouterModel = (
    model: OpenRouterModel,
    fetchedAt: number
): NormalizedOpenRouterModel | null => {
    if (typeof model.id !== "string" || !model.id.trim()) {
        return null
    }

    return {
        provider: "openrouter" as const,
        providerModelId: model.id,
        contextLength: parsePositiveNumber(model.context_length),
        maxCompletionTokens: parsePositiveNumber(model.top_provider?.max_completion_tokens),
        knowledgeCutoff: parseKnowledgeCutoff(model.knowledge_cutoff),
        inputUsdPer1MTokens: pricePerTokenToPerMillion(model.pricing?.prompt),
        outputUsdPer1MTokens: pricePerTokenToPerMillion(model.pricing?.completion),
        fetchedAt,
        source: "openrouter" as const
    }
}

const endpointMatchesProvider = (endpointTag: unknown, providerSlug: string) =>
    typeof endpointTag === "string" &&
    (endpointTag === providerSlug || endpointTag.startsWith(`${providerSlug}/`))

const applyPinnedOpenRouterPricing = (
    model: NormalizedOpenRouterModel,
    endpoints: OpenRouterEndpoint[],
    providerSlug: string
): NormalizedOpenRouterModel => {
    const matchedPrices = endpoints.flatMap((endpoint) => {
        if (!endpointMatchesProvider(endpoint.tag, providerSlug)) return []

        const inputUsdPer1MTokens = pricePerTokenToPerMillion(endpoint.pricing?.prompt)
        const outputUsdPer1MTokens = pricePerTokenToPerMillion(endpoint.pricing?.completion)
        if (inputUsdPer1MTokens === undefined || outputUsdPer1MTokens === undefined) return []

        return [{ inputUsdPer1MTokens, outputUsdPer1MTokens }]
    })

    if (!matchedPrices.length) return model

    return {
        ...model,
        inputUsdPer1MTokens: Math.max(
            ...matchedPrices.map((pricing) => pricing.inputUsdPer1MTokens)
        ),
        outputUsdPer1MTokens: Math.max(
            ...matchedPrices.map((pricing) => pricing.outputUsdPer1MTokens)
        ),
        pricingProvider: providerSlug
    }
}

const getOpenRouterEndpointsUrl = (providerModelId: string) =>
    `${OPENROUTER_MODELS_URL}/${providerModelId
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")}/endpoints`

const applyRegistryPricingPins = async (models: NormalizedOpenRouterModel[]) => {
    const pinsByProviderModelId = new Map(
        MODELS_SHARED.flatMap((model) => {
            const providerModelId = getOpenRouterProviderModelId(model)
            const providerSlug = model.openrouterProvider
            return providerModelId && providerSlug ? [[providerModelId, providerSlug] as const] : []
        })
    )

    return await Promise.all(
        models.map(async (model) => {
            const providerSlug = pinsByProviderModelId.get(model.providerModelId)
            if (!providerSlug) return model

            try {
                const response = await fetch(getOpenRouterEndpointsUrl(model.providerModelId), {
                    headers: {
                        Accept: "application/json"
                    }
                })
                if (!response.ok) {
                    throw new Error(`OpenRouter model endpoints fetch failed: ${response.status}`)
                }

                const payload = (await response.json()) as {
                    data?: { endpoints?: OpenRouterEndpoint[] }
                }
                return applyPinnedOpenRouterPricing(
                    model,
                    payload.data?.endpoints ?? [],
                    providerSlug
                )
            } catch (error) {
                console.error(
                    `[model-provider-metadata] Failed to refresh ${model.providerModelId} pricing for ${providerSlug}`,
                    error
                )
                return model
            }
        })
    )
}

export const syncOpenRouterModelMetadata = internalAction({
    args: {},
    handler: async (ctx): Promise<{ upserted: number }> => {
        const response = await fetch(OPENROUTER_MODELS_URL, {
            headers: {
                Accept: "application/json"
            }
        })

        if (!response.ok) {
            throw new Error(`OpenRouter models fetch failed: ${response.status}`)
        }

        const payload = (await response.json()) as { data?: OpenRouterModel[] }
        const fetchedAt = Date.now()
        const normalizedModels = (payload.data ?? [])
            .map((model) => normalizeOpenRouterModel(model, fetchedAt))
            .filter((model): model is NonNullable<typeof model> => model !== null)
        const models = await applyRegistryPricingPins(normalizedModels)

        return await ctx.runMutation(
            internal.model_provider_metadata.upsertOpenRouterModelMetadataInternal,
            {
                models
            }
        )
    }
})
