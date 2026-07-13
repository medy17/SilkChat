"use node"

import type { GenericActionCtx } from "convex/server"
import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { DataModel, Id } from "./_generated/dataModel"
import { action } from "./_generated/server"
import { assertAccountNotDeletingForAction } from "./lib/account_deletion_gate"
import { getUserIdentity } from "./lib/identity"
import {
    type PreparedMemoryChange,
    applyPreparedMemoryChange
} from "./lib/supermemory_memory_change"

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

        const apiKey = await ctx.runQuery(internal.settings.getSupermemoryKey, {
            userId: user.id
        })
        if (!apiKey) {
            const message = "Supermemory is no longer configured. Add your API key in settings."
            await failCard(message)
            throw new ConvexError(message)
        }

        try {
            const applied = await applyPreparedMemoryChange({
                apiKey,
                containerTag: user.id,
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
