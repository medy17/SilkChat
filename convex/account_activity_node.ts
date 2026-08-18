"use node"

import type { BetterAuthOptions } from "better-auth"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"
import { authComponent } from "./auth"

type AuthUser = {
    email?: unknown
    emailVerified?: unknown
    name?: unknown
}

export const deliverWelcomeEmail = internalAction({
    args: {
        authUserId: v.string(),
        email: v.string(),
        name: v.optional(v.string())
    },
    handler: async (_ctx, { authUserId, email, name }) => {
        const { sendWelcomeEmail } = await import("../src/lib/email")
        await sendWelcomeEmail({
            user: { email, name },
            idempotencyKey: `welcome/${authUserId}`
        })
    }
})

export const deliverInactiveAccountNotice = internalAction({
    args: {
        activityId: v.id("accountActivities")
    },
    handler: async (ctx, { activityId }) => {
        const queuedNotice = await ctx.runQuery(
            internal.account_activity.getQueuedInactiveAccountNotice,
            { activityId }
        )
        if (!queuedNotice) return

        const adapter = authComponent.adapter(ctx)({} as BetterAuthOptions)
        const user = (await adapter.findOne({
            model: "user",
            where: [{ field: "id", value: queuedNotice.authUserId }]
        })) as AuthUser | null

        if (!user) {
            await ctx.runMutation(internal.account_activity.markInactiveAccountNoticeSkipped, {
                activityId,
                reason: "auth-user-not-found"
            })
            return
        }

        if (typeof user.email !== "string" || !user.email.trim() || user.emailVerified !== true) {
            await ctx.runMutation(internal.account_activity.markInactiveAccountNoticeSkipped, {
                activityId,
                reason: "verified-email-unavailable"
            })
            return
        }

        const shouldDeliver = await ctx.runMutation(
            internal.account_activity.prepareInactiveAccountNoticeDelivery,
            { activityId }
        )
        if (!shouldDeliver) return

        try {
            const { sendInactiveAccountNoticeEmail } = await import("../src/lib/email")
            await sendInactiveAccountNoticeEmail({
                email: user.email,
                name: typeof user.name === "string" ? user.name : undefined,
                idempotencyKey: `inactive-account/${activityId}`
            })
            await ctx.runMutation(internal.account_activity.markInactiveAccountNoticeSent, {
                activityId
            })
        } catch (error) {
            console.error("Failed to deliver inactive account notice", {
                activityId,
                error: error instanceof Error ? error.message : "Unknown email delivery error"
            })
            await ctx.runMutation(internal.account_activity.releaseInactiveAccountNotice, {
                activityId
            })
        }
    }
})
