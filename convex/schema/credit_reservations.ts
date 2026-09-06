import { PrototypeCreditFeature } from "./credits"
import { v } from "convex/values"

export const PrototypeCreditReservation = v.object({
    userId: v.string(),
    threadId: v.optional(v.id("threads")),
    messageId: v.string(),
    messageKey: v.string(),
    modelId: v.optional(v.string()),
    providerSource: v.union(
        v.literal("internal"),
        v.literal("byok"),
        v.literal("openrouter"),
        v.literal("custom"),
        v.literal("unknown")
    ),
    feature: PrototypeCreditFeature,
    bucket: v.union(v.literal("basic"), v.literal("pro"), v.literal("none")),
    units: v.number(),
    counted: v.boolean(),
    accountingKind: v.optional(v.literal("usage")),
    reservedMicrousd: v.optional(v.number()),
    pricingSource: v.optional(
        v.union(
            v.literal("openrouter_estimate"),
            v.literal("fal_manual"),
            v.literal("sandbox_estimate")
        )
    ),
    providerRequestId: v.optional(v.string()),
    periodKey: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    finalizedAt: v.optional(v.number())
})
