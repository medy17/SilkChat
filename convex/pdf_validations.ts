import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"
import { r2 } from "./attachments"
import { MAX_FILE_SIZE, MAX_PDF_PAGES } from "@/lib/file_constants"

// Read the cache in the database runtime; only misses need a Node action.
// R2 is a component, so each metadata read still crosses that boundary.
export const checkMany = internalQuery({
    args: { files: v.array(v.object({ storageKey: v.string(), fileName: v.string() })) },
    handler: async (ctx, { files }) => {
        if (files.length > 100) throw new Error("Too many PDFs to validate at once")
        const results: Array<{ storageKey: string; pageCount?: number; error?: string }> = []
        for (const { storageKey, fileName } of files) {
            if (!storageKey.startsWith("attachments/")) {
                results.push({
                    storageKey,
                    error: "External PDFs cannot be used in chat. Upload the PDF again"
                })
                continue
            }
            const metadata = await r2.getMetadata(ctx, storageKey)
            if (
                metadata?.uploadStatus !== "ready" ||
                !metadata.lastModified ||
                typeof metadata.size !== "number"
            ) {
                results.push({
                    storageKey,
                    error: `${fileName}: PDF is unavailable. Upload it again`
                })
                continue
            }
            const objectVersion = JSON.stringify([
                metadata.bucket,
                metadata.lastModified,
                metadata.size,
                metadata.sha256 ?? null
            ])
            const cached = await ctx.db
                .query("pdfValidations")
                .withIndex("byStorageKey", (q) => q.eq("storageKey", storageKey))
                .unique()
            if (cached?.objectVersion === objectVersion && cached.error) {
                results.push({ storageKey, error: cached.error })
            } else if (
                cached?.objectVersion === objectVersion &&
                metadata.size <= MAX_FILE_SIZE &&
                typeof cached.pageCount === "number"
            ) {
                results.push(
                    cached.pageCount > MAX_PDF_PAGES
                        ? {
                              storageKey,
                              error: `${fileName} has ${cached.pageCount} pages. The maximum is ${MAX_PDF_PAGES}. Split the PDF and try again`
                          }
                        : { storageKey, pageCount: cached.pageCount }
                )
            } else results.push({ storageKey })
        }
        return results
    }
})

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
