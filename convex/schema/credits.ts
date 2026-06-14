import { v } from "convex/values"

export const PrototypeCreditPlan = v.union(v.literal("free"), v.literal("pro"))
export const PrototypeCreditBucket = v.union(
    v.literal("basic"),
    v.literal("pro"),
    v.literal("none")
)
export const PrototypeCreditProviderSource = v.union(
    v.literal("internal"),
    v.literal("byok"),
    v.literal("openrouter"),
    v.literal("custom"),
    v.literal("unknown")
)
export const PrototypeCreditFeature = v.union(
    v.literal("chat"),
    v.literal("image"),
    v.literal("tool")
)

export const PrototypeCreditAccount = v.object({
    userId: v.string(),
    enabled: v.boolean(),
    plan: PrototypeCreditPlan,
    monthlyBasicCredits: v.optional(v.number()),
    monthlyProCredits: v.optional(v.number()),
    creditPeriodAnchorAt: v.optional(v.number()),
    updatedAt: v.number()
})

export const PrototypeCreditEvent = v.object({
    userId: v.string(),
    threadId: v.optional(v.id("threads")),
    messageId: v.string(),
    messageKey: v.string(),
    modelId: v.optional(v.string()),
    providerSource: PrototypeCreditProviderSource,
    feature: PrototypeCreditFeature,
    bucket: PrototypeCreditBucket,
    units: v.number(),
    counted: v.boolean(),
    periodKey: v.string(),
    createdAt: v.number()
})

export const PrototypeToolCallReservation = v.object({
    userId: v.string(),
    threadId: v.optional(v.id("threads")),
    messageId: v.string(),
    messageKey: v.string(),
    reservedCalls: v.number(),
    consumedCalls: v.number(),
    reservedBasicCredits: v.number(),
    consumedBasicCredits: v.number(),
    periodKey: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    finalizedAt: v.optional(v.number())
})
