import { v } from "convex/values"
import { internalQuery, type QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { getUserRegistry } from "./settings"
import { getUserCreditPlan } from "./credits"
import { getActiveAccountDeletionJob } from "./lib/account_deletion_status"

// Internal only: the registry contains decrypted provider credentials.
export const readThreadContext = async (ctx: QueryCtx, userId: string, threadId: Id<"threads">) => {
    const thread = await ctx.db.get(threadId)
    if (!thread || thread.authorId !== userId) throw new Error("Thread unavailable")
    const messages = await ctx.db
        .query("messages")
        .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
        .order("desc")
        .collect()
    const personaSnapshot = await ctx.db
        .query("threadPersonaSnapshots")
        .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
        .first()
    return { messages, personaSnapshot }
}

export const get = internalQuery({
    args: { userId: v.string(), threadId: v.optional(v.id("threads")) },
    handler: async (ctx, { userId, threadId }) => {
        const deletion = await getActiveAccountDeletionJob(ctx, userId)
        if (deletion) return { blocked: true as const }
        const context = threadId ? await readThreadContext(ctx, userId, threadId) : null
        const registry = await getUserRegistry(ctx, userId)
        const plan = await getUserCreditPlan(ctx, userId)
        return { blocked: false as const, registry, plan, context }
    }
})

// Keep a fresh snapshot after the message mutation: edits/retries change history.
export const getThreadContext = internalQuery({
    args: { userId: v.string(), threadId: v.id("threads") },
    handler: (ctx, { userId, threadId }) => readThreadContext(ctx, userId, threadId)
})
