import { v } from "convex/values"
import { type MutationCtx, internalMutation, query } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"
import {
    isLemonSqueezySubscriptionEvent,
    parseLemonSqueezyWebhookPayload
} from "./lib/lemon_squeezy"

const getCreditAccount = async (ctx: MutationCtx, userId: string) => {
    return await ctx.db
        .query("prototypeCreditAccounts")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .first()
}

const getSubscription = async (ctx: MutationCtx, subscriptionId: string) => {
    return await ctx.db
        .query("lemonSqueezySubscriptions")
        .withIndex("bySubscriptionId", (q) => q.eq("lemonSqueezySubscriptionId", subscriptionId))
        .first()
}

export const getMyBillingSummary = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return null
        }

        const [account, subscriptions] = await Promise.all([
            ctx.db
                .query("prototypeCreditAccounts")
                .withIndex("byUser", (q) => q.eq("userId", user.id))
                .first(),
            ctx.db
                .query("lemonSqueezySubscriptions")
                .withIndex("byUser", (q) => q.eq("userId", user.id))
                .collect()
        ])
        const subscription =
            subscriptions.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null

        return {
            plan: account?.plan ?? "free",
            subscription: subscription
                ? {
                      status: subscription.status,
                      renewsAt: subscription.renewsAt,
                      endsAt: subscription.endsAt,
                      trialEndsAt: subscription.trialEndsAt,
                      lemonSqueezySubscriptionId: subscription.lemonSqueezySubscriptionId,
                      lemonSqueezyCustomerId: subscription.lemonSqueezyCustomerId,
                      updatedAt: subscription.updatedAt
                  }
                : null
        }
    }
})

export const recordLemonSqueezyWebhook = internalMutation({
    args: {
        payload: v.any()
    },
    handler: async (ctx, { payload }) => {
        const summary = parseLemonSqueezyWebhookPayload(payload)
        if (!summary) {
            return { status: "ignored" as const, reason: "invalid_payload" as const }
        }

        const existingEvent = await ctx.db
            .query("lemonSqueezyWebhookEvents")
            .withIndex("byEventId", (q) => q.eq("eventId", summary.eventId))
            .first()

        if (existingEvent) {
            return { status: "duplicate" as const, eventId: summary.eventId }
        }

        const now = Date.now()
        await ctx.db.insert("lemonSqueezyWebhookEvents", {
            eventId: summary.eventId,
            eventName: summary.eventName,
            userId: summary.userId,
            subscriptionId: summary.subscriptionId,
            processedAt: now
        })

        if (
            !isLemonSqueezySubscriptionEvent(summary.eventName) ||
            !summary.userId ||
            !summary.subscriptionId ||
            !summary.plan ||
            !summary.status
        ) {
            return { status: "ignored" as const, eventId: summary.eventId }
        }

        const existingSubscription = await getSubscription(ctx, summary.subscriptionId)
        const nextSubscription = {
            userId: summary.userId,
            lemonSqueezySubscriptionId: summary.subscriptionId,
            lemonSqueezyCustomerId: summary.customerId,
            lemonSqueezyOrderId: summary.orderId,
            lemonSqueezyProductId: summary.productId,
            lemonSqueezyVariantId: summary.variantId,
            status: summary.status,
            plan: summary.plan,
            renewsAt: summary.renewsAt,
            endsAt: summary.endsAt,
            trialEndsAt: summary.trialEndsAt,
            updatedAt: now,
            lastEventId: summary.eventId
        }

        if (existingSubscription?._id) {
            await ctx.db.patch(existingSubscription._id, nextSubscription)
        } else {
            await ctx.db.insert("lemonSqueezySubscriptions", nextSubscription)
        }

        const existingAccount = await getCreditAccount(ctx, summary.userId)
        const nextAccount = {
            userId: summary.userId,
            enabled: existingAccount?.enabled ?? true,
            plan: summary.plan,
            monthlyBasicCredits: existingAccount?.monthlyBasicCredits,
            monthlyProCredits: existingAccount?.monthlyProCredits,
            updatedAt: now
        }

        if (existingAccount?._id) {
            await ctx.db.patch(existingAccount._id, nextAccount)
        } else {
            await ctx.db.insert("prototypeCreditAccounts", nextAccount)
        }

        return { status: "processed" as const, eventId: summary.eventId, plan: summary.plan }
    }
})
