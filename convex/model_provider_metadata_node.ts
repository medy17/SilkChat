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
import type { ModelProviderMetadata } from "./schema/model_provider_metadata"

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
type Metadata = Infer<typeof ModelProviderMetadata>

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
            models.set(model.id, {
                provider: "openrouter",
                providerModelId: model.id,
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
                        const url = `${OPENROUTER_MODELS_URL}/${slug.split("/").map(encodeURIComponent).join("/")}/endpoints`
                        const endpoints = parseRoutingEndpoints(
                            await fetchJson(url, true),
                            slug,
                            zdrKeys
                        )
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

        const rows = [...models.values()]
        let upserted = 0
        for (let offset = 0; offset < rows.length; offset += 20) {
            const result = await ctx.runMutation(
                internal.model_provider_metadata.upsertOpenRouterModelMetadataInternal,
                { models: rows.slice(offset, offset + 20) }
            )
            upserted += result.upserted
        }
        return { upserted }
    }
})
