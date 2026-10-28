import { v } from "convex/values"

export const TextPart = v.object({
    type: v.literal("text"),
    text: v.string()
})

export const ImagePart = v.object({
    type: v.literal("image"),
    image: v.string(),
    mimeType: v.string()
})

export const ReasoningPart = v.object({
    type: v.literal("reasoning"),
    reasoning: v.string(),
    signature: v.optional(v.string()),
    duration: v.optional(v.number()),
    details: v.optional(
        v.array(
            v.object({
                type: v.union(v.literal("text"), v.literal("redacted")),
                text: v.optional(v.string()),
                data: v.optional(v.string()),
                signature: v.optional(v.string())
            })
        )
    )
})

export const FilePart = v.object({
    type: v.literal("file"),
    data: v.string(),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string())
})

export const ErrorUIPart = v.object({
    type: v.literal("error"),
    error: v.object({
        code: v.string(),
        message: v.string(),
        detail: v.optional(
            v.union(
                v.object({
                    kind: v.literal("context_limit_exceeded"),
                    limitType: v.union(v.literal("hosted"), v.literal("model")),
                    estimatedTokens: v.number(),
                    limitTokens: v.number(),
                    modelId: v.string(),
                    canUseByok: v.optional(v.boolean()),
                    suggestedModels: v.optional(
                        v.array(v.object({ id: v.string(), name: v.string() }))
                    )
                }),
                v.object({
                    kind: v.literal("provider_error"),
                    category: v.union(
                        v.literal("insufficient_credits"),
                        v.literal("invalid_key"),
                        v.literal("moderation"),
                        v.literal("rate_limited"),
                        v.literal("timeout"),
                        v.literal("context_overflow"),
                        v.literal("invalid_request"),
                        v.literal("provider_unavailable"),
                        v.literal("network"),
                        v.literal("unknown")
                    ),
                    keySource: v.union(v.literal("hosted"), v.literal("byok")),
                    providerName: v.optional(v.string()),
                    statusCode: v.optional(v.number()),
                    providerMessage: v.optional(v.string()),
                    retryAfterSeconds: v.optional(v.number())
                })
            )
        )
    })
})
export const ToolInvocationUIPart = v.object({
    type: v.literal("tool-invocation"),
    toolInvocation: v.object({
        state: v.union(v.literal("call"), v.literal("result"), v.literal("partial-call")),
        args: v.optional(v.any()),
        result: v.optional(v.any()),
        toolCallId: v.string(),
        toolName: v.string(),
        step: v.optional(v.number())
    })
})

export const MessagePart = v.union(
    TextPart,
    ImagePart,
    ReasoningPart,
    FilePart,
    ErrorUIPart,
    ToolInvocationUIPart
)
