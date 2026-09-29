"use node"

import type { Infer } from "convex/values"
import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"
import { MODELS_SHARED, getOpenRouterProviderModelId, isChatModel } from "./lib/models"
import {
    buildRoutingMetadata,
    parseNonNegativePrice,
    parseRoutingEndpoints,
    parseZdrEndpointKeys,
    pricePerMillion
} from "./lib/model_routing_metadata"
import { isTextChatModel } from "./lib/openrouter_catalog"
import type { ModelProviderMetadata } from "./schema/model_provider_metadata"

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
type Metadata = Infer<typeof ModelProviderMetadata>

const getEndpointsUrl = (slug: string) =>
    `${OPENROUTER_MODELS_URL}/${slug.split("/").map(encodeURIComponent).join("/")}/endpoints`

// Undefined when the listing is malformed, so an unreadable response isn't taken as zero.
const countEndpoints = (payload: unknown) => {
    const endpoints = (payload as { data?: { endpoints?: unknown } } | undefined)?.data?.endpoints
    return Array.isArray(endpoints) ? endpoints.length : undefined
}

const fetchJson = async (url: string, allowMissingEndpoints = false) => {
    const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
    })
    if (allowMissingEndpoints && response.status === 404) return { data: { endpoints: [] } }
    if (!response.ok) throw new Error(`OpenRouter metadata fetch failed: ${response.status}`)
    return response.json()
}

export const syncOpenRouterModelMetadata = internalAction({
    args: {},
    handler: async (ctx): Promise<{ upserted: number }> => {
        const payload = await fetchJson(OPENROUTER_MODELS_URL)
        if (!Array.isArray(payload?.data)) throw new Error("Invalid OpenRouter model catalog")
        const fetchedAt = Date.now()
        const models = new Map<string, Metadata>()
        for (const model of payload.data) {
            if (typeof model?.id !== "string" || !model.id.trim()) continue
            const positive = (value: unknown) => {
                const parsed = parseNonNegativePrice(value)
                return parsed && parsed > 0 ? parsed : undefined
            }
            const strings = (value: unknown) =>
                Array.isArray(value)
                    ? value.filter((item): item is string => typeof item === "string")
                    : undefined
            models.set(model.id, {
                provider: "openrouter",
                providerModelId: model.id,
                name:
                    typeof model.name === "string" && model.name.trim()
                        ? model.name.trim()
                        : undefined,
                description:
                    typeof model.description === "string" && model.description.trim()
                        ? model.description.trim()
                        : undefined,
                inputModalities: strings(model.architecture?.input_modalities),
                outputModalities: strings(model.architecture?.output_modalities),
                supportedParameters: strings(model.supported_parameters),
                aliasOf:
                    typeof model.alias_target?.slug === "string"
                        ? model.alias_target.slug
                        : undefined,
                expirationDate:
                    typeof model.expiration_date === "string" && model.expiration_date.trim()
                        ? model.expiration_date.trim()
                        : undefined,
                reasoning:
                    model.reasoning && typeof model.reasoning === "object"
                        ? {
                              mandatory:
                                  typeof model.reasoning.mandatory === "boolean"
                                      ? model.reasoning.mandatory
                                      : undefined,
                              supportedEfforts: strings(model.reasoning.supported_efforts),
                              defaultEffort:
                                  typeof model.reasoning.default_effort === "string"
                                      ? model.reasoning.default_effort
                                      : undefined
                          }
                        : undefined,
                contextLength: positive(model.context_length),
                maxCompletionTokens: positive(model.top_provider?.max_completion_tokens),
                knowledgeCutoff:
                    typeof model.knowledge_cutoff === "string" &&
                    /^\d{4}-\d{2}-\d{2}$/.test(model.knowledge_cutoff.trim())
                        ? model.knowledge_cutoff.trim()
                        : undefined,
                inputUsdPer1MTokens: pricePerMillion(model.pricing?.prompt),
                outputUsdPer1MTokens: pricePerMillion(model.pricing?.completion),
                fetchedAt,
                source: "openrouter"
            })
        }

        const registry = new Map(
            MODELS_SHARED.filter(isChatModel).flatMap((model) => {
                const slug = getOpenRouterProviderModelId(model)
                return slug ? [[slug, model] as const] : []
            })
        )
        let zdrKeys: Set<string> | undefined
        try {
            zdrKeys = parseZdrEndpointKeys(
                await fetchJson("https://openrouter.ai/api/v1/endpoints/zdr")
            )
        } catch (error) {
            console.error("[model-provider-metadata] Keeping previous ZDR snapshot", error)
        }

        // Bound concurrency; one listing includes default, flex, and priority tiers.
        const registered = [...registry.entries()]
        for (let offset = 0; offset < registered.length; offset += 6) {
            await Promise.all(
                registered.slice(offset, offset + 6).map(async ([slug, model]) => {
                    const metadata: Metadata = models.get(slug) ?? {
                        provider: "openrouter",
                        providerModelId: slug,
                        fetchedAt,
                        source: "openrouter"
                    }
                    models.set(slug, metadata)
                    try {
                        const listing = await fetchJson(getEndpointsUrl(slug), true)
                        metadata.providerCount = countEndpoints(listing)
                        const endpoints = parseRoutingEndpoints(listing, slug, zdrKeys)
                        metadata.routing = buildRoutingMetadata(
                            endpoints,
                            fetchedAt,
                            model.preferredOpenRouterProviders,
                            zdrKeys !== undefined
                        )
                    } catch (error) {
                        console.error(
                            `[model-provider-metadata] Keeping previous routing snapshot for ${slug}`,
                            error
                        )
                    }
                })
            )
        }

        // Provider counts for the rest of the chat catalog, so Settings can hide aliases,
        // routers, and models no provider serves any more. A failed fetch leaves the count
        // unset and the previous one is kept.
        const uncounted = [...models.values()].filter(
            (metadata) => metadata.providerCount === undefined && isTextChatModel(metadata)
        )
        for (let offset = 0; offset < uncounted.length; offset += 8) {
            await Promise.all(
                uncounted.slice(offset, offset + 8).map(async (metadata) => {
                    try {
                        metadata.providerCount = countEndpoints(
                            await fetchJson(getEndpointsUrl(metadata.providerModelId), true)
                        )
                    } catch (error) {
                        console.error(
                            `[model-provider-metadata] Keeping previous provider count for ${metadata.providerModelId}`,
                            error
                        )
                    }
                })
            )
        }

        const rows = [...models.values()]
        let upserted = 0
        for (let offset = 0; offset < rows.length; offset += 20) {
            const result = await ctx.runMutation(
                internal.model_provider_metadata.upsertOpenRouterModelMetadataInternal,
                { models: rows.slice(offset, offset + 20) }
            )
            upserted += result.upserted
        }

        await ctx.runMutation(
            internal.model_provider_metadata.markRemovedOpenRouterModelsInternal,
            {
                presentModelIds: [...models.keys()],
                removedAt: fetchedAt
            }
        )
        return { upserted }
    }
})
