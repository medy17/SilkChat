import { v } from "convex/values"
import { ModelRoutingMetadata } from "./model_routing"

export const ModelProviderMetadata = v.object({
    provider: v.literal("openrouter"),
    providerModelId: v.string(),
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
