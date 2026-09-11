import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"

export const getStreamsByThreadId = internalQuery({
    args: { threadId: v.id("threads") },
    handler: async ({ db }, { threadId }) => {
        return await db
            .query("streams")
            .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
            .collect()
    }
})

export const appendStreamId = internalMutation({
    args: {
        threadId: v.id("threads"),
        ownerClientId: v.optional(v.string()),
        userId: v.string(),
        assistantMessageConvexId: v.id("messages")
    },
    handler: async (ctx, { threadId, ownerClientId, userId, assistantMessageConvexId }) => {
        await assertAccountNotDeleting(ctx, userId)
        const thread = await ctx.db.get(threadId)
        const message = await ctx.db.get(assistantMessageConvexId)
        if (
            !thread ||
            thread.authorId !== userId ||
            !message ||
            message.threadId !== threadId ||
            message.role !== "assistant"
        ) {
            throw new Error("Turn is no longer available")
        }
        const streamId = await ctx.db.insert("streams", {
            threadId,
            ownerClientId,
            createdAt: Date.now()
        })
        await ctx.db.patch(threadId, { lastStreamId: streamId })
        await ctx.db.patch(assistantMessageConvexId, { generationStreamId: streamId })
        return streamId
    }
})
