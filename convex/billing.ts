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

const getSubscriptionLink = async (ctx: MutationCtx, subscriptionId: string) => {
    return await ctx.db
        .query("billingSubscriptionLinks")
        .withIndex("bySubscriptionId", (q) => q.eq("lemonSqueezySubscriptionId", subscriptionId))
        .first()
}

const getSuppressionBySubscriptionId = async (ctx: MutationCtx, subscriptionId: string) => {
    return await ctx.db
        .query("identitySuppressions")
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
            userId: user.id,
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
            !summary.subscriptionId ||
            !summary.plan ||
            !summary.status
        ) {
            return { status: "ignored" as const, eventId: summary.eventId }
        }

        const [existingLink, suppression] = await Promise.all([
            getSubscriptionLink(ctx, summary.subscriptionId),
            getSuppressionBySubscriptionId(ctx, summary.subscriptionId)
        ])
        const resolvedUserId =
            existingLink?.liveUserId ??
            suppression?.relinkedToUserId ??
            (suppression ? undefined : summary.userId)
        const suppressionId = existingLink?.suppressionId ?? suppression?._id
        const nextLink = {
            lemonSqueezySubscriptionId: summary.subscriptionId,
            lemonSqueezyCustomerId: summary.customerId,
            liveUserId: resolvedUserId,
            suppressionId,
            status: summary.status,
            plan: summary.plan,
            renewsAt: summary.renewsAt,
            endsAt: summary.endsAt,
            trialEndsAt: summary.trialEndsAt,
            lastEventId: summary.eventId,
            updatedAt: now
        }

        if (existingLink?._id) {
            await ctx.db.patch(existingLink._id, nextLink)
        } else {
            await ctx.db.insert("billingSubscriptionLinks", nextLink)
        }

        if (!resolvedUserId) {
            if (summary.eventName === "subscription_payment_refunded" && suppression?._id) {
                await ctx.db.patch(suppression._id, {
                    refundCount: (suppression.refundCount ?? 0) + 1,
                    proEntitlementEndsAt: now,
                    lastDeletedAt: now
                })

                return {
                    status: "processed_tombstone" as const,
                    eventId: summary.eventId,
                    plan: summary.plan
                }
            }

            return { status: "linked" as const, eventId: summary.eventId, plan: summary.plan }
        }

        const existingSubscription = await getSubscription(ctx, summary.subscriptionId)
        const nextSubscription = {
            userId: resolvedUserId,
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

        const existingAccount = await getCreditAccount(ctx, resolvedUserId)
        const nextAccount = {
            userId: resolvedUserId,
            enabled: existingAccount?.enabled ?? true,
            plan: summary.plan,
            monthlyBasicCredits: existingAccount?.monthlyBasicCredits,
            monthlyProCredits: existingAccount?.monthlyProCredits,
            creditPeriodAnchorAt: existingAccount?.creditPeriodAnchorAt ?? now,
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
