import { v } from "convex/values"

export const BillingPlan = v.union(v.literal("free"), v.literal("pro"))

export const LemonSqueezySubscription = v.object({
    userId: v.string(),
    lemonSqueezySubscriptionId: v.string(),
    lemonSqueezyCustomerId: v.optional(v.string()),
    lemonSqueezyOrderId: v.optional(v.string()),
    lemonSqueezyProductId: v.optional(v.string()),
    lemonSqueezyVariantId: v.optional(v.string()),
    status: v.string(),
    plan: BillingPlan,
    renewsAt: v.optional(v.string()),
    endsAt: v.optional(v.string()),
    trialEndsAt: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    lastEventId: v.string()
})

export const LemonSqueezyWebhookEvent = v.object({
    eventId: v.string(),
    eventName: v.string(),
    userId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    processedAt: v.number()
})
