import { v } from "convex/values"
import { ModelRoutingMetadata } from "./model_routing"

export const ModelProviderMetadata = v.object({
    provider: v.literal("openrouter"),
    providerModelId: v.string(),
    // Catalog details used to prefill custom OpenRouter models in Settings.
    name: v.optional(v.string()),
    // OpenRouter's description preview; its API only serves a truncated version.
    description: v.optional(v.string()),
    inputModalities: v.optional(v.array(v.string())),
    outputModalities: v.optional(v.array(v.string())),
    supportedParameters: v.optional(v.array(v.string())),
    // Set on "~vendor/...-latest" aliases, whose target model changes over time.
    aliasOf: v.optional(v.string()),
    // OpenRouter's announced removal date, when one is scheduled.
    expirationDate: v.optional(v.string()),
    // Endpoints currently serving the model; 0 for aliases, routers, and abandoned models.
    providerCount: v.optional(v.number()),
    // When the model left OpenRouter's catalog. Rows are kept so custom models that point
    // at it can say why they stopped working; a model that returns clears this.
    removedAt: v.optional(v.number()),
    reasoning: v.optional(
        v.object({
            mandatory: v.optional(v.boolean()),
            supportedEfforts: v.optional(v.array(v.string())),
            defaultEffort: v.optional(v.string())
        })
    ),
    contextLength: v.optional(v.number()),
    maxCompletionTokens: v.optional(v.number()),
    knowledgeCutoff: v.optional(v.string()),
    inputUsdPer1MTokens: v.optional(v.number()),
    outputUsdPer1MTokens: v.optional(v.number()),
    pricingProvider: v.optional(v.string()),
    routing: v.optional(ModelRoutingMetadata),
    fetchedAt: v.number(),
    source: v.literal("openrouter")
})
