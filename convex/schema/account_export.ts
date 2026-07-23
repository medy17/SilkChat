import { v } from "convex/values"

export const AccountExportJob = v.object({
    userId: v.string(),
    email: v.string(),
    keyHash: v.string(),
    consentSensitiveDataLinksAccepted: v.optional(v.boolean()),
    consentOneTimePasswordAccepted: v.optional(v.boolean()),
    consentAcceptedAt: v.optional(v.number()),
    status: v.union(
        v.literal("reserved"),
        v.literal("building"),
        v.literal("uploaded"),
        v.literal("delivered"),
        v.literal("failed")
    ),
    objectKey: v.optional(v.string()),
    downloadUrl: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    error: v.optional(v.string()),
    emailProviderMessageId: v.optional(v.string()),
    deliveryAttempts: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deliveredAt: v.optional(v.number())
})
