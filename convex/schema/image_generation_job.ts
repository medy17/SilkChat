import { v } from "convex/values"

export const ImageGenerationJobStatus = v.union(
    v.literal("submitting"),
    v.literal("submitted"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("partial"),
    // Generation succeeded at fal (credit committed) but we could not materialize
    // the asset into R2. Non-terminal: recoverable via a user-requested refetch.
    v.literal("storing_failed"),
    v.literal("refunded"),
    v.literal("failed"),
    v.literal("unknown")
)

export const ImageGenerationJobAsset = v.object({
    url: v.string(),
    contentType: v.optional(v.string())
})

export const ImageGenerationJob = v.object({
    userId: v.string(),
    clientRequestId: v.optional(v.string()),
    source: v.optional(v.union(v.literal("library"), v.literal("chat"))),
    sourceThreadId: v.optional(v.id("threads")),
    sourceMessageId: v.optional(v.string()),
    sourceToolCallId: v.optional(v.string()),
    sourceCardId: v.optional(v.string()),
    appModelId: v.string(),
    falEndpoint: v.string(),
    falRequestId: v.optional(v.string()),
    falGatewayRequestId: v.optional(v.string()),
    prompt: v.string(),
    aspectRatio: v.string(),
    resolution: v.optional(v.string()),
    referenceImageKeys: v.array(v.string()),
    creditEventKey: v.string(),
    status: ImageGenerationJobStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
    processingStartedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    generatedImageIds: v.optional(v.array(v.id("generatedImages"))),
    // Source image URLs returned by fal, persisted so a failed asset fetch can be
    // retried without re-generating (valid only while fal's URLs live).
    assetUrls: v.optional(v.array(ImageGenerationJobAsset)),
    assetFetchAttempts: v.optional(v.number()),
    lastAssetFetchAttemptAt: v.optional(v.number()),
    error: v.optional(v.string()),
    webhookPayload: v.optional(v.any())
})
