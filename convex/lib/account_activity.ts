import type { MutationCtx } from "../_generated/server"

export const INACTIVITY_NOTICE_MONTHS = 24
export const INACTIVITY_NOTICE_BATCH_SIZE = 100

export const getInactiveAccountCutoff = (now: number) => {
    const cutoff = new Date(now)
    cutoff.setUTCMonth(cutoff.getUTCMonth() - INACTIVITY_NOTICE_MONTHS)
    return cutoff.getTime()
}

export const recordAuthenticatedActivity = async (
    ctx: Pick<MutationCtx, "db">,
    authUserId: string,
    now = Date.now()
) => {
    const activity = await ctx.db
        .query("accountActivities")
        .withIndex("byAuthUserId", (q) => q.eq("authUserId", authUserId))
        .unique()

    if (!activity) {
        await ctx.db.insert("accountActivities", {
            authUserId,
            lastActiveAt: now,
            inactivityNoticeState: "pending"
        })
        return
    }

    await ctx.db.patch(activity._id, {
        lastActiveAt: Math.max(activity.lastActiveAt, now),
        ...(activity.inactivityNoticeState === "queued"
            ? {
                  inactivityNoticeState: "pending" as const,
                  inactivityNoticeQueuedAt: undefined
              }
            : {})
    })
}

export const removeAccountActivity = async (ctx: Pick<MutationCtx, "db">, authUserId: string) => {
    const activity = await ctx.db
        .query("accountActivities")
        .withIndex("byAuthUserId", (q) => q.eq("authUserId", authUserId))
        .unique()

    if (activity) {
        await ctx.db.delete(activity._id)
    }
}
