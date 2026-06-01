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
    feature: v.union(v.literal("chat"), v.literal("image"), v.literal("tool")),
    bucket: v.union(v.literal("basic"), v.literal("pro"), v.literal("none")),
    units: v.number(),
    counted: v.boolean(),
    periodKey: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    finalizedAt: v.optional(v.number())
})
