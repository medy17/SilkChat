import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { internalMutation, internalQuery, query } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"
import { MessagePart } from "./schema/parts"

const getRecordArray = (value: unknown) =>
    Array.isArray(value)
        ? value.filter(
              (entry): entry is Record<string, unknown> =>
                  typeof entry === "object" && entry !== null
          )
        : []

const mergeStringArrays = (current: unknown, next: unknown) => {
    if (!Array.isArray(next)) return next
    const merged = new Set<string>()

    for (const value of Array.isArray(current) ? current : []) {
        if (typeof value === "string") merged.add(value)
    }
    for (const value of next) {
        if (typeof value === "string") merged.add(value)
    }

    return Array.from(merged)
}

const getAssetIdentity = (asset: Record<string, unknown>) => {
    const generatedImageId = asset.generatedImageId
    if (typeof generatedImageId === "string") return `id:${generatedImageId}`

    const storageKey = asset.storageKey
    if (typeof storageKey === "string") return `key:${storageKey}`

    const imageUrl = asset.imageUrl
    if (typeof imageUrl === "string") return `url:${imageUrl}`

    return JSON.stringify(asset)
}

const getVariantIndex = (asset: Record<string, unknown>) => {
    const variantIndex = asset.variantIndex
    return typeof variantIndex === "number" && Number.isFinite(variantIndex)
        ? variantIndex
        : undefined
}

const mergeAssetArrays = (current: unknown, next: unknown) => {
    if (!Array.isArray(next)) return next

    const merged = new Map<string, Record<string, unknown>>()
    for (const asset of [...getRecordArray(current), ...getRecordArray(next)]) {
        merged.set(getAssetIdentity(asset), asset)
    }

    return Array.from(merged.values()).sort((left, right) => {
        const leftIndex = getVariantIndex(left)
        const rightIndex = getVariantIndex(right)
        if (leftIndex === undefined && rightIndex === undefined) return 0
        if (leftIndex === undefined) return 1
        if (rightIndex === undefined) return -1
        return leftIndex - rightIndex
    })
}

const mergePreparedImageGenerationResult = (
    currentResult: Record<string, unknown>,
    update: Record<string, unknown>
) => {
    const merged = {
        ...currentResult,
        ...update
    }

    if ("generatedImageIds" in update) {
        merged.generatedImageIds = mergeStringArrays(
            currentResult.generatedImageIds,
            update.generatedImageIds
        )
    }
    if ("assets" in update) {
        merged.assets = mergeAssetArrays(currentResult.assets, update.assets)
    }

    return merged
}

const findPreparedImageGenerationResult = (
    parts: Array<{ type: string; toolInvocation?: unknown }>,
    toolCallId: string,
    cardId: string
) => {
    for (const part of parts) {
        if (part.type !== "tool-invocation") continue

        const invocation = part.toolInvocation as
            | {
                  toolName?: unknown
                  toolCallId?: unknown
                  state?: unknown
                  result?: unknown
              }
            | undefined
        if (
            invocation?.toolName !== "prepareImageGeneration" ||
            invocation.toolCallId !== toolCallId ||
            invocation.state !== "result" ||
            typeof invocation.result !== "object" ||
            invocation.result === null ||
            (invocation.result as Record<string, unknown>).cardId !== cardId
        ) {
            continue
        }

        return invocation.result as Record<string, unknown>
    }

    return null
}

export const getMessagesByThreadId = internalQuery({
    args: { threadId: v.id("threads") },
    handler: async ({ db }, { threadId }) => {
        return await db
            .query("messages")
            .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
            .order("desc")
            .collect()
    }
})

export const getPreparedImageGenerationCardResult = query({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async ({ db, auth }, { threadId, messageId, toolCallId, cardId }) => {
        const user = await getUserIdentity(auth, { allowAnons: false })
        if ("error" in user) return null

        const thread = await db.get(threadId)
        if (!thread || thread.authorId !== user.id) return null

        const messages = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const message = messages.find((candidate) => candidate.threadId === threadId)
        if (!message) return null

        return findPreparedImageGenerationResult(message.parts, toolCallId, cardId)
    }
})

export const patchPreparedImageGenerationToolResult = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string(),
        update: v.any()
    },
    handler: async ({ db }, { threadId, messageId, toolCallId, cardId, update }) => {
        const msgs = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const msg = msgs.find((candidate) => candidate.threadId === threadId)
        if (!msg) return null

        const parts = msg.parts.map((part) => {
            if (
                part.type !== "tool-invocation" ||
                part.toolInvocation.toolName !== "prepareImageGeneration" ||
                part.toolInvocation.toolCallId !== toolCallId ||
                part.toolInvocation.state !== "result" ||
                typeof part.toolInvocation.result !== "object" ||
                part.toolInvocation.result === null
            ) {
                return part
            }

            const currentResult = part.toolInvocation.result as Record<string, unknown>
            if (currentResult.cardId !== cardId) {
                return part
            }

            return {
                ...part,
                toolInvocation: {
                    ...part.toolInvocation,
                    result: mergePreparedImageGenerationResult(
                        currentResult,
                        update as Record<string, unknown>
                    )
                }
            }
        })

        await db.patch(msg._id as Id<"messages">, {
            parts,
            updatedAt: Date.now()
        })
        await db.patch(threadId, {
            updatedAt: Date.now()
        })

        return { success: true }
    }
})

// Atomically claims a pending image-generation card for submission. Because Convex
// mutations are transactional, this compare-and-swap closes the double-confirm race:
// only the first caller flips `pending_confirmation` -> `submitting` and gets the card
// back; concurrent confirms observe the already-claimed status and bail out.
export const claimPreparedImageGenerationCard = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async ({ db }, { threadId, messageId, toolCallId, cardId }) => {
        const msgs = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const msg = msgs.find((candidate) => candidate.threadId === threadId)
        if (!msg || msg.role !== "assistant") {
            return { ok: false as const, reason: "not_found" as const }
        }

        const part = msg.parts.find(
            (candidate) =>
                candidate.type === "tool-invocation" &&
                candidate.toolInvocation.toolName === "prepareImageGeneration" &&
                candidate.toolInvocation.toolCallId === toolCallId &&
                candidate.toolInvocation.state === "result" &&
                typeof candidate.toolInvocation.result === "object" &&
                candidate.toolInvocation.result !== null &&
                (candidate.toolInvocation.result as Record<string, unknown>).cardId === cardId
        )
        if (!part || part.type !== "tool-invocation") {
            return { ok: false as const, reason: "not_found" as const }
        }

        const currentResult = part.toolInvocation.result as Record<string, unknown>
        if (currentResult.status !== "pending_confirmation") {
            return { ok: false as const, reason: "not_pending" as const }
        }

        const parts = msg.parts.map((candidate) =>
            candidate === part
                ? {
                      ...candidate,
                      toolInvocation: {
                          ...candidate.toolInvocation,
                          result: { ...currentResult, status: "submitting" }
                      }
                  }
                : candidate
        )

        await db.patch(msg._id as Id<"messages">, {
            parts,
            updatedAt: Date.now()
        })
        await db.patch(threadId, {
            updatedAt: Date.now()
        })

        return { ok: true as const, result: currentResult }
    }
})

const MEMORY_CHANGE_TOOL_NAMES = new Set(["add_memory", "update_memory", "forget_memory"])

export const patchPreparedMemoryChangeToolResult = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string(),
        update: v.any()
    },
    handler: async ({ db }, { threadId, messageId, toolCallId, cardId, update }) => {
        const msgs = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const msg = msgs.find((candidate) => candidate.threadId === threadId)
        if (!msg) return null

        let didPatch = false
        const parts = msg.parts.map((part) => {
            if (
                part.type !== "tool-invocation" ||
                !MEMORY_CHANGE_TOOL_NAMES.has(part.toolInvocation.toolName) ||
                part.toolInvocation.toolCallId !== toolCallId ||
                part.toolInvocation.state !== "result" ||
                typeof part.toolInvocation.result !== "object" ||
                part.toolInvocation.result === null
            ) {
                return part
            }

            const currentResult = part.toolInvocation.result as Record<string, unknown>
            if (
                currentResult.kind !== "prepared_memory_change" ||
                currentResult.cardId !== cardId
            ) {
                return part
            }

            didPatch = true
            return {
                ...part,
                toolInvocation: {
                    ...part.toolInvocation,
                    result: {
                        ...currentResult,
                        ...(update as Record<string, unknown>)
                    }
                }
            }
        })

        if (!didPatch) return null

        await db.patch(msg._id as Id<"messages">, {
            parts,
            updatedAt: Date.now()
        })
        await db.patch(threadId, {
            updatedAt: Date.now()
        })

        return { success: true }
    }
})

// Claims a pending memory mutation before the external write. Convex mutations are
// transactional, so only one tab can transition a card out of pending confirmation.
export const claimPreparedMemoryChangeCard = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async ({ db }, { threadId, messageId, toolCallId, cardId }) => {
        const msgs = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const msg = msgs.find((candidate) => candidate.threadId === threadId)
        if (!msg || msg.role !== "assistant") {
            return { ok: false as const, reason: "not_found" as const }
        }

        const part = msg.parts.find(
            (candidate) =>
                candidate.type === "tool-invocation" &&
                MEMORY_CHANGE_TOOL_NAMES.has(candidate.toolInvocation.toolName) &&
                candidate.toolInvocation.toolCallId === toolCallId &&
                candidate.toolInvocation.state === "result" &&
                typeof candidate.toolInvocation.result === "object" &&
                candidate.toolInvocation.result !== null &&
                (candidate.toolInvocation.result as Record<string, unknown>).kind ===
                    "prepared_memory_change" &&
                (candidate.toolInvocation.result as Record<string, unknown>).cardId === cardId
        )
        if (!part || part.type !== "tool-invocation") {
            return { ok: false as const, reason: "not_found" as const }
        }

        const currentResult = part.toolInvocation.result as Record<string, unknown>
        if (currentResult.status !== "pending_confirmation") {
            return { ok: false as const, reason: "not_pending" as const }
        }

        const parts = msg.parts.map((candidate) =>
            candidate === part
                ? {
                      ...candidate,
                      toolInvocation: {
                          ...candidate.toolInvocation,
                          result: { ...currentResult, status: "executing" }
                      }
                  }
                : candidate
        )

        await db.patch(msg._id as Id<"messages">, {
            parts,
            updatedAt: Date.now()
        })
        await db.patch(threadId, {
            updatedAt: Date.now()
        })

        return { ok: true as const, result: currentResult }
    }
})

export const cancelPreparedMemoryChangeCard = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async ({ db }, args) => {
        const msgs = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", args.messageId))
            .collect()
        const msg = msgs.find((candidate) => candidate.threadId === args.threadId)
        if (!msg || msg.role !== "assistant") return { ok: false as const }

        let cancelled = false
        const parts = msg.parts.map((part) => {
            if (
                part.type !== "tool-invocation" ||
                !MEMORY_CHANGE_TOOL_NAMES.has(part.toolInvocation.toolName) ||
                part.toolInvocation.toolCallId !== args.toolCallId ||
                part.toolInvocation.state !== "result" ||
                typeof part.toolInvocation.result !== "object" ||
                part.toolInvocation.result === null
            ) {
                return part
            }

            const result = part.toolInvocation.result as Record<string, unknown>
            if (
                result.kind !== "prepared_memory_change" ||
                result.cardId !== args.cardId ||
                result.status !== "pending_confirmation"
            ) {
                return part
            }

            cancelled = true
            return {
                ...part,
                toolInvocation: {
                    ...part.toolInvocation,
                    result: { ...result, status: "cancelled" }
                }
            }
        })

        if (!cancelled) return { ok: false as const }

        await db.patch(msg._id as Id<"messages">, { parts, updatedAt: Date.now() })
        await db.patch(args.threadId, { updatedAt: Date.now() })
        return { ok: true as const }
    }
})

export const patchMessage = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        parts: v.array(MessagePart),
        metadata: v.optional(
            v.object({
                modelId: v.optional(v.string()),
                modelName: v.optional(v.string()),
                displayProvider: v.optional(v.string()),
                runtimeProvider: v.optional(v.string()),
                reasoningEffort: v.optional(
                    v.union(
                        v.literal("off"),
                        v.literal("minimal"),
                        v.literal("low"),
                        v.literal("medium"),
                        v.literal("high")
                    )
                ),
                promptTokens: v.optional(v.number()),
                completionTokens: v.optional(v.number()),
                reasoningTokens: v.optional(v.number()),
                totalTokens: v.optional(v.number()),
                estimatedCostUsd: v.optional(v.number()),
                estimatedPromptCostUsd: v.optional(v.number()),
                estimatedCompletionCostUsd: v.optional(v.number()),
                serverDurationMs: v.optional(v.number()),
                timeToFirstVisibleMs: v.optional(v.number()),
                creditProviderSource: v.optional(
                    v.union(
                        v.literal("internal"),
                        v.literal("byok"),
                        v.literal("openrouter"),
                        v.literal("custom"),
                        v.literal("unknown")
                    )
                ),
                creditBucket: v.optional(
                    v.union(v.literal("basic"), v.literal("pro"), v.literal("none"))
                ),
                creditFeature: v.optional(
                    v.union(v.literal("chat"), v.literal("image"), v.literal("tool"))
                ),
                creditUnits: v.optional(v.number()),
                creditCounted: v.optional(v.boolean()),
                contextRouting: v.optional(
                    v.object({
                        mode: v.literal("byok_fallback"),
                        reason: v.union(v.literal("message"), v.literal("thread")),
                        limitType: v.literal("hosted"),
                        estimatedTokens: v.number(),
                        limitTokens: v.number()
                    })
                )
            })
        )
    },
    handler: async ({ db }, { threadId, messageId, parts, metadata }) => {
        const msgs = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const msg = msgs[0]
        if (!msg) return

        await db.patch(msg._id as Id<"messages">, {
            parts,
            metadata: {
                ...msg.metadata,
                ...metadata
            },
            updatedAt: Date.now()
        })

        await db.patch(threadId, {
            updatedAt: Date.now()
        })

        // Create usage event for analytics
        if (metadata?.modelId) {
            const thread = await db.get(threadId)
            if (thread) {
                await db.insert("usageEvents", {
                    userId: thread.authorId,
                    modelId: metadata.modelId,
                    p: metadata.promptTokens ?? 0,
                    c: metadata.completionTokens ?? 0,
                    r: metadata.reasoningTokens ?? 0,
                    daysSinceEpoch: Math.floor(Date.now() / (24 * 60 * 60 * 1000))
                })
            }
        }

        return { success: true, _id: msg._id }
    }
})
