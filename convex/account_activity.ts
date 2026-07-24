import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, internalQuery } from "./_generated/server"
import {
    INACTIVITY_NOTICE_BATCH_SIZE,
    getInactiveAccountCutoff,
    recordAuthenticatedActivity as recordActivity
} from "./lib/account_activity"

export const recordAuthenticatedActivity = internalMutation({
    args: {
        authUserId: v.string()
    },
    handler: async (ctx, { authUserId }) => {
        await recordActivity(ctx, authUserId)
    }
})

export const queueInactiveAccountNotices = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const cutoff = getInactiveAccountCutoff(now)
        const candidates = await ctx.db
            .query("accountActivities")
            .withIndex("byNoticeStateAndLastActiveAt", (q) =>
                q.eq("inactivityNoticeState", "pending").lte("lastActiveAt", cutoff)
            )
            .take(INACTIVITY_NOTICE_BATCH_SIZE)

        for (const candidate of candidates) {
            await ctx.db.patch(candidate._id, {
                inactivityNoticeState: "queued",
                inactivityNoticeQueuedAt: now
            })
            await ctx.scheduler.runAfter(
                0,
                internal.account_activity_node.deliverInactiveAccountNotice,
                {
                    activityId: candidate._id
                }
            )
        }

        return { queued: candidates.length }
    }
})

export const getQueuedInactiveAccountNotice = internalQuery({
    args: {
        activityId: v.id("accountActivities")
    },
    handler: async (ctx, { activityId }) => {
        const activity = await ctx.db.get(activityId)
        if (!activity || activity.inactivityNoticeState !== "queued") return null
        return { authUserId: activity.authUserId }
    }
})

export const prepareInactiveAccountNoticeDelivery = internalMutation({
    args: {
        activityId: v.id("accountActivities")
    },
    handler: async (ctx, { activityId }) => {
        const activity = await ctx.db.get(activityId)
        if (!activity || activity.inactivityNoticeState !== "queued") return false

        if (activity.lastActiveAt > getInactiveAccountCutoff(Date.now())) {
            await ctx.db.patch(activityId, {
                inactivityNoticeState: "pending",
                inactivityNoticeQueuedAt: undefined
            })
            return false
        }

        return true
    }
})

export const markInactiveAccountNoticeSent = internalMutation({
    args: {
        activityId: v.id("accountActivities")
    },
    handler: async (ctx, { activityId }) => {
        const activity = await ctx.db.get(activityId)
        if (!activity) return

        await ctx.db.patch(activityId, {
            inactivityNoticeState: "sent",
            inactivityNoticeQueuedAt: undefined,
            inactivityNoticeSentAt: Date.now(),
            inactivityNoticeDeliveryAttempts: (activity.inactivityNoticeDeliveryAttempts ?? 0) + 1
        })
    }
})

export const markInactiveAccountNoticeSkipped = internalMutation({
    args: {
        activityId: v.id("accountActivities"),
        reason: v.string()
    },
    handler: async (ctx, { activityId, reason }) => {
        const activity = await ctx.db.get(activityId)
        if (!activity) return

        await ctx.db.patch(activityId, {
            inactivityNoticeState: "skipped",
            inactivityNoticeQueuedAt: undefined,
            inactivityNoticeSkippedAt: Date.now(),
            inactivityNoticeSkipReason: reason
        })
    }
})

export const releaseInactiveAccountNotice = internalMutation({
    args: {
        activityId: v.id("accountActivities")
    },
    handler: async (ctx, { activityId }) => {
        const activity = await ctx.db.get(activityId)
        if (!activity || activity.inactivityNoticeState !== "queued") return

        await ctx.db.patch(activityId, {
            inactivityNoticeState: "pending",
            inactivityNoticeQueuedAt: undefined,
            inactivityNoticeDeliveryAttempts: (activity.inactivityNoticeDeliveryAttempts ?? 0) + 1
        })
    }
})
