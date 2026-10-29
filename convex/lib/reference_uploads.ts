import type { MutationCtx } from "../_generated/server"

export const getReferenceUpload = (ctx: MutationCtx, key: string) =>
    ctx.db
        .query("referenceUploads")
        .withIndex("byKey", (q) => q.eq("key", key))
        .first()

// Used references stay forever: generated images link to them.
export const markReferenceUploadsUsed = async (
    ctx: MutationCtx,
    userId: string,
    keys: readonly string[] = []
) => {
    const usedAt = Date.now()
    for (const key of keys) {
        if (!key.startsWith("references/")) continue
        const upload = await getReferenceUpload(ctx, key)
        if (upload && upload.userId === userId && upload.usedAt === undefined) {
            await ctx.db.patch(upload._id, { usedAt })
        }
    }
}
