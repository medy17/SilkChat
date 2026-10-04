import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, internalQuery, mutation } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"
import { collectVisualRequests, visualRequestKey } from "../src/lib/visual-selections"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { StoredVisual, VisualSelection } from "./schema/visuals"

export const getMessage = internalQuery({
    args: { messageDocId: v.id("messages") },
    handler: async (ctx, { messageDocId }) => {
        const message = await ctx.db.get(messageDocId)
        if (!message) return null
        const thread = await ctx.db.get(message.threadId)
        if (!thread) return null
        return { message, userId: thread.authorId }
    }
})

// Transactionally deduplicate tool executions and quick looks before spending quota.
export const claimSearch = internalMutation({
    args: {
        messageDocId: v.id("messages"),
        userId: v.string(),
        requestKey: v.string(),
        query: v.string()
    },
    handler: async (ctx, args) => {
        await assertAccountNotDeleting(ctx, args.userId)
        const message = await ctx.db.get(args.messageDocId)
        const thread = message && (await ctx.db.get(message.threadId))
        if (message?.role !== "assistant" || thread?.authorId !== args.userId)
            throw new Error("Visual message unavailable")
        const existing = await ctx.db
            .query("visualSearchRuns")
            .withIndex("byMessageRequest", (q) =>
                q.eq("messageDocId", args.messageDocId).eq("requestKey", args.requestKey)
            )
            .unique()
        if (existing) return { claimed: false, run: existing }
        const now = Date.now()
        const key = `visual-search:${args.userId}`
        const quota = await ctx.db
            .query("rateLimit")
            .withIndex("key", (q) => q.eq("key", key))
            .first()
        if (quota && now - quota.lastRequest < 600_000 && quota.count >= 30)
            throw new Error("Visual search allowance reached. Try again later.")
        if (quota)
            await ctx.db.patch(
                quota._id,
                now - quota.lastRequest >= 600_000
                    ? { count: 1, lastRequest: now }
                    : { count: quota.count + 1 }
            )
        else await ctx.db.insert("rateLimit", { key, count: 1, lastRequest: now })
        const id = await ctx.db.insert("visualSearchRuns", {
            ...args,
            status: "pending",
            assets: [],
            expiresAt: now + 24 * 60 * 60 * 1000
        })
        // Scheduled before downloads so interrupted staging is still cleaned up.
        await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.visuals_node.cleanupRun, {
            runId: id
        })
        return { claimed: true, run: (await ctx.db.get(id))! }
    }
})

export const finishSearch = internalMutation({
    args: {
        runId: v.id("visualSearchRuns"),
        assets: v.array(StoredVisual),
        failed: v.optional(v.boolean()),
        alteredQuery: v.optional(v.string()),
        strictWarning: v.optional(v.boolean())
    },
    handler: async (ctx, { runId, assets, failed, alteredQuery, strictWarning }) => {
        const run = await ctx.db.get(runId)
        if (!run) return
        await assertAccountNotDeleting(ctx, run.userId)
        if (!(await ctx.db.get(run.messageDocId))) return
        await ctx.db.patch(runId, {
            assets,
            status: failed ? "failed" : "ready",
            alteredQuery,
            strictWarning
        })
    }
})

export const getRun = internalQuery({
    args: { runId: v.id("visualSearchRuns") },
    handler: (ctx, { runId }) => ctx.db.get(runId)
})
export const deleteRun = internalMutation({
    args: { runId: v.id("visualSearchRuns") },
    handler: (ctx, { runId }) => ctx.db.delete(runId)
})
export const expiredRuns = internalQuery({
    args: {},
    handler: (ctx) =>
        ctx.db
            .query("visualSearchRuns")
            .withIndex("byExpiry", (q) => q.lt("expiresAt", Date.now()))
            .take(50)
})

// Legacy replies have no saved result. Resolve only on an explicit user action,
// once per actual message, never automatically when the renderer mounts.
export const resolveLegacy = mutation({
    args: { threadId: v.id("threads"), messageId: v.string() },
    handler: async (ctx, { threadId, messageId }) => {
        const identity = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in identity) throw new Error("Unauthorized")
        const thread = await ctx.db.get(threadId)
        if (thread?.authorId !== identity.id) throw new Error("Unauthorized")
        await assertAccountNotDeleting(ctx, identity.id)
        const messages = await ctx.db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const message = messages.find(
            (message) => message.threadId === threadId && message.role === "assistant"
        )
        if (thread.isLive) return "busy" as const
        if (!message) return "unavailable" as const
        if (message.metadata.visualStatus) return "already-started" as const
        if (
            !message.parts.some(
                (part) => part.type === "text" && collectVisualRequests(part.text).length > 0
            )
        )
            return "unavailable" as const
        await ctx.db.patch(message._id, {
            metadata: { ...message.metadata, visualStatus: "pending" }
        })
        const args = { messageDocId: message._id, expectedStreamId: message.generationStreamId }
        await ctx.scheduler.runAfter(0, internal.visuals_node.resolveMessage, args)
        await ctx.scheduler.runAfter(10 * 60 * 1000, internal.visuals.failStalledSelection, args)
        return "started" as const
    }
})

export const failStalledSelection = internalMutation({
    args: { messageDocId: v.id("messages"), expectedStreamId: v.optional(v.id("streams")) },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageDocId)
        if (
            message?.generationStreamId === args.expectedStreamId &&
            message?.metadata.visualStatus === "pending"
        ) {
            await ctx.db.patch(message._id, {
                metadata: { ...message.metadata, visualStatus: "failed" }
            })
        }
    }
})

export const finishSelection = internalMutation({
    args: {
        messageDocId: v.id("messages"),
        expectedStreamId: v.optional(v.id("streams")),
        selections: v.array(VisualSelection),
        failed: v.optional(v.boolean()),
        partial: v.optional(v.boolean())
    },
    handler: async (ctx, { messageDocId, expectedStreamId, selections, failed, partial }) => {
        const message = await ctx.db.get(messageDocId)
        if (!message || message.generationStreamId !== expectedStreamId) return false
        if (partial && message.metadata.visualStatus !== "pending") return false
        const thread = await ctx.db.get(message.threadId)
        if (!thread) return false
        await assertAccountNotDeleting(ctx, thread.authorId)
        const merged = new Map(
            [...(message.metadata.visualSelections ?? []), ...selections].map((selection) => [
                selection.key,
                selection
            ])
        )
        const orderedKeys = Array.from(
            new Set(
                message.parts.flatMap((part) =>
                    part.type === "text"
                        ? collectVisualRequests(part.text).map(visualRequestKey)
                        : []
                )
            )
        )
        await ctx.db.patch(messageDocId, {
            metadata: {
                ...message.metadata,
                visualSelections: partial
                    ? orderedKeys.flatMap((key) => (merged.has(key) ? [merged.get(key)!] : []))
                    : selections,
                visualStatus: partial ? "pending" : failed ? "failed" : "ready"
            }
        })
        return true
    }
})
