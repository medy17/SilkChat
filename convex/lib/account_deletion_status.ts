import type { MutationCtx, QueryCtx } from "../_generated/server"

export const ACTIVE_DELETION_STATUSES = new Set(["pending", "purging", "retrying"])

type AccountDeletionCtx = QueryCtx | MutationCtx

export const getAccountDeletionJob = async (ctx: AccountDeletionCtx, userId: string) => {
    const query = ctx.db
        .query("accountDeletionJobs")
        .withIndex("byUser", (q) => q.eq("userId", userId))
    if (typeof query.first !== "function") return null

    return await query.first()
}

export const getActiveAccountDeletionJob = async (ctx: AccountDeletionCtx, userId: string) => {
    const job = await getAccountDeletionJob(ctx, userId)
    const status = (job as { status?: string } | null)?.status
    if (!job || !status || status === "completed") return null
    return job
}

export const assertAccountNotDeleting = async (ctx: AccountDeletionCtx, userId: string) => {
    const job = await getActiveAccountDeletionJob(ctx, userId)
    if (!job) return

    throw new Error("Account deletion is in progress")
}
