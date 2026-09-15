import { type Infer, v } from "convex/values"

export const ModelRoutingMode = v.union(v.literal("silkchat"), v.literal("zdr"), v.literal("floor"))
export type ModelRoutingMode = Infer<typeof ModelRoutingMode>

export const RoutingPrice = v.object({
    inputUsdPer1MTokens: v.optional(v.number()),
    outputUsdPer1MTokens: v.optional(v.number()),
    cacheReadUsdPer1MTokens: v.optional(v.number()),
    cacheWriteUsdPer1MTokens: v.optional(v.number()),
    requestUsd: v.optional(v.number())
})

export const RoutingEndpoint = v.object({
    tag: v.string(),
    providerName: v.string(),
    pricing: RoutingPrice,
    contextLength: v.optional(v.number()),
    maxCompletionTokens: v.optional(v.number()),
    supportedParameters: v.optional(v.array(v.string())),
    zdr: v.optional(v.boolean())
})
export type RoutingEndpoint = Infer<typeof RoutingEndpoint>

export const ModelRoutingSummary = v.object({
    available: v.boolean(),
    // Rollout compatibility only. New snapshots never persist endpoint listings.
    endpoints: v.optional(v.array(RoutingEndpoint)),
    pricing: v.optional(RoutingPrice),
    pricingEndpoint: v.optional(v.string()),
    contextLength: v.optional(v.number()),
    maxCompletionTokens: v.optional(v.number()),
    fetchedAt: v.number()
})
export type ModelRoutingSummary = Infer<typeof ModelRoutingSummary>

export const ModelRoutingMetadata = v.object({
    silkchat: v.optional(ModelRoutingSummary),
    zdr: v.optional(ModelRoutingSummary),
    floor: v.optional(ModelRoutingSummary)
})
export type ModelRoutingMetadata = Infer<typeof ModelRoutingMetadata>
