import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"

export const get = internalQuery({
    args: { storageKey: v.string() },
    handler: (ctx, { storageKey }) =>
        ctx.db
            .query("pdfValidations")
            .withIndex("byStorageKey", (q) => q.eq("storageKey", storageKey))
            .unique()
})

// Only trusted server code can persist parsing results; clients cannot supply a page count.
export const save = internalMutation({
    args: {
        storageKey: v.string(),
        objectVersion: v.string(),
        pageCount: v.optional(v.number()),
        error: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("pdfValidations")
            .withIndex("byStorageKey", (q) => q.eq("storageKey", args.storageKey))
            .unique()
        const record = { ...args, checkedAt: Date.now() }
        if (existing) await ctx.db.replace(existing._id, record)
        else await ctx.db.insert("pdfValidations", record)
    }
})
