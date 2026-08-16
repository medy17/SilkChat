"use node"

import type { GenericActionCtx } from "convex/server"
import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { DataModel, Id } from "./_generated/dataModel"
import { action, internalAction } from "./_generated/server"
import { assertAccountNotDeletingForAction } from "./lib/account_deletion_gate"
import { getUserIdentity } from "./lib/identity"
import {
    type SupermemoryMemoryListResponse,
    getSupermemoryApiKey,
    getSupermemoryContainerTag,
    getSupermemoryConversationCustomId,
    supermemoryRequest
} from "./lib/supermemory_api"
import {
    type PreparedMemoryChange,
    applyPreparedMemoryChange
} from "./lib/supermemory_memory_change"

export const ingestConversationTurn = internalAction({
    args: {
        userId: v.string(),
        threadId: v.id("threads"),
        content: v.string()
    },
    handler: async (_ctx, { userId, threadId, content }) => {
        const apiKey = getSupermemoryApiKey()
        const normalizedContent = content.trim()
        if (!apiKey || !normalizedContent) return

        try {
            await supermemoryRequest<{ id: string; status: string }>(apiKey, "/v3/documents", {
                body: {
                    content: normalizedContent,
                    containerTag: await getSupermemoryContainerTag(userId),
                    customId: await getSupermemoryConversationCustomId(userId, String(threadId)),
                    metadata: { type: "conversation", source: "silkchat" },
                    dreaming: "dynamic"
                }
            })
        } catch (error) {
            console.error("[cvx][chat][memory] Failed to ingest conversation turn:", error)
        }
    }
})

const getOwnedThread = async (
    ctx: GenericActionCtx<DataModel>,
    threadId: Id<"threads">,
    userId: string
) => {
    const thread = await ctx.runQuery(internal.threads.getThreadById, { threadId })
    if (!thread || thread.authorId !== userId) {
        throw new ConvexError("Thread not found.")
    }
    return thread
}

export const confirmPreparedMemoryChange = action({
    args: {
        threadId: v.id("threads"),
        assistantMessageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async (ctx, args): Promise<{ operation: string; memoryId?: string }> => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized.")
        await assertAccountNotDeletingForAction(ctx, user.id)
        await getOwnedThread(ctx, args.threadId, user.id)

        const claim = await ctx.runMutation(internal.messages.claimPreparedMemoryChangeCard, {
            threadId: args.threadId,
            messageId: args.assistantMessageId,
            toolCallId: args.toolCallId,
            cardId: args.cardId
        })
        if (!claim.ok) {
            throw new ConvexError("Memory change is no longer awaiting confirmation.")
        }

        const failCard = async (error: string) => {
            await ctx.runMutation(internal.messages.patchPreparedMemoryChangeToolResult, {
                threadId: args.threadId,
                messageId: args.assistantMessageId,
                toolCallId: args.toolCallId,
                cardId: args.cardId,
                update: { status: "failed", error }
            })
        }

        const change = claim.result as PreparedMemoryChange
        if (
            change.success !== true ||
            change.kind !== "prepared_memory_change" ||
            !change.operation
        ) {
            const message = "Memory change is no longer confirmable."
            await failCard(message)
            throw new ConvexError(message)
        }

        const apiKey = getSupermemoryApiKey()
        if (!apiKey) {
            const message = "Memory isn't available right now."
            await failCard(message)
            throw new ConvexError(message)
        }

        try {
            const applied = await applyPreparedMemoryChange({
                apiKey,
                containerTag: await getSupermemoryContainerTag(user.id),
                change
            })

            await ctx.runMutation(internal.messages.patchPreparedMemoryChangeToolResult, {
                threadId: args.threadId,
                messageId: args.assistantMessageId,
                toolCallId: args.toolCallId,
                cardId: args.cardId,
                update: {
                    status: "completed",
                    completedAt: new Date().toISOString(),
                    // The upstream mutation response is not guaranteed to echo an id
                    // (notably for deletes), and Convex rejects undefined values.
                    ...(typeof applied.memoryId === "string" && applied.memoryId
                        ? { memoryId: applied.memoryId }
                        : {})
                }
            })

            return applied
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Could not apply this memory change."
            await failCard(message)
            throw new ConvexError(message)
        }
    }
})

const getHostedMemoryIdentity = async (ctx: GenericActionCtx<DataModel>) => {
    const user = await getUserIdentity(ctx.auth, { allowAnons: false })
    if ("error" in user) throw new ConvexError("Unauthorized.")
    await assertAccountNotDeletingForAction(ctx, user.id)

    const apiKey = getSupermemoryApiKey()
    if (!apiKey) throw new ConvexError("Memory isn't available right now.")

    return {
        apiKey,
        containerTag: await getSupermemoryContainerTag(user.id)
    }
}

export const listMemories = action({
    args: {
        page: v.optional(v.number()),
        limit: v.optional(v.number())
    },
    handler: async (ctx, { page = 1, limit = 20 }) => {
        const { apiKey, containerTag } = await getHostedMemoryIdentity(ctx)
        const safePage = Math.max(1, Math.floor(page))
        const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)))
        return await supermemoryRequest<SupermemoryMemoryListResponse>(
            apiKey,
            "/v4/memories/list",
            {
                body: {
                    containerTags: [containerTag],
                    page: safePage,
                    limit: safeLimit,
                    order: "desc",
                    sort: "updatedAt"
                }
            }
        )
    }
})

export const createMemory = action({
    args: { content: v.string() },
    handler: async (ctx, { content }) => {
        const normalizedContent = content.trim()
        if (!normalizedContent) throw new ConvexError("Memory content is required.")
        if (normalizedContent.length > 10_000) {
            throw new ConvexError("Memory content must be 10,000 characters or fewer.")
        }
        const { apiKey, containerTag } = await getHostedMemoryIdentity(ctx)
        return await supermemoryRequest<{ memories: Array<{ id: string; memory: string }> }>(
            apiKey,
            "/v4/memories",
            {
                body: {
                    containerTag,
                    memories: [{ content: normalizedContent, isStatic: true }]
                }
            }
        )
    }
})

export const updateMemory = action({
    args: { memoryId: v.string(), content: v.string() },
    handler: async (ctx, { memoryId, content }) => {
        const normalizedContent = content.trim()
        if (!memoryId.trim() || !normalizedContent) {
            throw new ConvexError("Memory ID and content are required.")
        }
        if (normalizedContent.length > 10_000) {
            throw new ConvexError("Memory content must be 10,000 characters or fewer.")
        }
        const { apiKey, containerTag } = await getHostedMemoryIdentity(ctx)
        return await supermemoryRequest<{ id: string; memory: string }>(apiKey, "/v4/memories", {
            method: "PATCH",
            body: { id: memoryId, containerTag, newContent: normalizedContent }
        })
    }
})

export const forgetMemory = action({
    args: { memoryId: v.string() },
    handler: async (ctx, { memoryId }) => {
        if (!memoryId.trim()) throw new ConvexError("Memory ID is required.")
        const { apiKey, containerTag } = await getHostedMemoryIdentity(ctx)
        return await supermemoryRequest<{ id: string; forgotten: boolean }>(
            apiKey,
            "/v4/memories",
            {
                method: "DELETE",
                body: { id: memoryId, containerTag, reason: "Removed by the user in SilkChat." }
            }
        )
    }
})

export const cancelPreparedMemoryChange = action({
    args: {
        threadId: v.id("threads"),
        assistantMessageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async (ctx, args): Promise<{ cancelled: boolean }> => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized.")
        await assertAccountNotDeletingForAction(ctx, user.id)
        await getOwnedThread(ctx, args.threadId, user.id)

        const result = await ctx.runMutation(internal.messages.cancelPreparedMemoryChangeCard, {
            threadId: args.threadId,
            messageId: args.assistantMessageId,
            toolCallId: args.toolCallId,
            cardId: args.cardId
        })
        if (!result.ok) {
            throw new ConvexError("Memory change is no longer awaiting confirmation.")
        }
        return { cancelled: true }
    }
})
