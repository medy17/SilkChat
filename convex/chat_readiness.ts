import { v } from "convex/values"
import { internalQuery, type QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { getUserRegistry } from "./settings"
import { getUserCreditPlan } from "./credits"
import { getActiveAccountDeletionJob } from "./lib/account_deletion_status"
import { readThreadSkills, resolveNewThreadSkills } from "./lib/thread_skills"

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
    return {
        messages,
        personaSnapshot,
        skills: await readThreadSkills(ctx, threadId),
        openingToolSelection: thread.openingToolSelection,
        openingVerbosity: thread.openingVerbosity,
        personalizationDisabled: thread.personalizationDisabled === true
    }
}

export const get = internalQuery({
    args: {
        userId: v.string(),
        threadId: v.optional(v.id("threads")),
        // What a new chat picked. Without a pick it gets the skills that are on for new chats.
        skillSlugs: v.optional(v.array(v.string()))
    },
    handler: async (ctx, { userId, threadId, skillSlugs }) => {
        const deletion = await getActiveAccountDeletionJob(ctx, userId)
        if (deletion) return { blocked: true as const }
        const context = threadId ? await readThreadContext(ctx, userId, threadId) : null
        const registry = await getUserRegistry(ctx, userId)
        const plan = await getUserCreditPlan(ctx, userId)
        // A chat that is about to be created has no skills of its own yet.
        const newThreadSkills = threadId
            ? []
            : await resolveNewThreadSkills(ctx, userId, skillSlugs)
        return { blocked: false as const, registry, plan, context, newThreadSkills }
    }
})

// Keep a fresh snapshot after the message mutation: edits/retries change history.
export const getThreadContext = internalQuery({
    args: { userId: v.string(), threadId: v.id("threads") },
    handler: (ctx, { userId, threadId }) => readThreadContext(ctx, userId, threadId)
})
