import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, mutation } from "./_generated/server"
import { r2 } from "./attachments"
import { getUserIdentity } from "./lib/identity"
import { getReferenceUpload } from "./lib/reference_uploads"

// Library references upload as soon as they're added, before any generation uses them.
// Unused ones are deleted when removed and capped per user, so uploads alone can't
// accumulate storage. Used ones stay forever: generated images link to them.
export const MAX_UNUSED_REFERENCE_UPLOADS = 20
// Long enough that nobody's deliberately saved references disappear.
export const UNUSED_REFERENCE_UPLOAD_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SWEEP_BATCH_SIZE = 100

// The cap only runs when the same user uploads again; this catches abandoned ones.
export const sweepStaleReferenceUploads = internalMutation({
    args: {},
    handler: async (ctx) => {
        const stale = await ctx.db
            .query("referenceUploads")
            .withIndex("byUsedAt", (q) =>
                q
                    .eq("usedAt", undefined)
                    .lt("_creationTime", Date.now() - UNUSED_REFERENCE_UPLOAD_TTL_MS)
            )
            .take(SWEEP_BATCH_SIZE)
        for (const upload of stale) {
            await ctx.db.delete(upload._id)
            await r2.deleteObject(ctx, upload.key)
        }
        if (stale.length === SWEEP_BATCH_SIZE) {
            await ctx.scheduler.runAfter(0, internal.reference_uploads.sweepStaleReferenceUploads)
        }
    }
})

export const recordReferenceUpload = internalMutation({
    args: { userId: v.string(), key: v.string() },
    handler: async (ctx, args) => {
        if (!(await getReferenceUpload(ctx, args.key))) {
            await ctx.db.insert("referenceUploads", { userId: args.userId, key: args.key })
        }

        const unused = await ctx.db
            .query("referenceUploads")
            .withIndex("byUserIdAndUsedAt", (q) =>
                q.eq("userId", args.userId).eq("usedAt", undefined)
            )
            .collect()
        for (const upload of unused.slice(
            0,
            Math.max(0, unused.length - MAX_UNUSED_REFERENCE_UPLOADS)
        )) {
            await ctx.db.delete(upload._id)
            await r2.deleteObject(ctx, upload.key)
        }
    }
})

export const releaseReferenceUpload = mutation({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return

        const upload = await getReferenceUpload(ctx, args.key)
        if (!upload || upload.userId !== user.id || upload.usedAt !== undefined) return

        await ctx.db.delete(upload._id)
        await r2.deleteObject(ctx, upload.key)
    }
})
