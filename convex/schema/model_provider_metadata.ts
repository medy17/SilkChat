import { v } from "convex/values"

export const ModelProviderMetadata = v.object({
    provider: v.literal("openrouter"),
    providerModelId: v.string(),
    contextLength: v.optional(v.number()),
    maxCompletionTokens: v.optional(v.number()),
    inputUsdPer1MTokens: v.optional(v.number()),
    outputUsdPer1MTokens: v.optional(v.number()),
    fetchedAt: v.number(),
    source: v.literal("openrouter")
})
