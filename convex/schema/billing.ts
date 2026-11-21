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

// Binds a Freemius user to a SilkChat user. Created the first time a synced
// Freemius user's email matches a SilkChat account; kept even if emails change later.
export const FreemiusCustomer = v.object({
    fsUserId: v.string(),
    userId: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
})

// The last state read from the Freemius API for one license. userId is unset while
// the Freemius user isn't bound to a SilkChat account.
export const FreemiusLicense = v.object({
    fsLicenseId: v.string(),
    fsUserId: v.string(),
    userId: v.optional(v.string()),
    fsPlanId: v.string(),
    fsPricingId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    isCancelled: v.boolean(),
    isSandbox: v.boolean(),
    syncedAt: v.number()
})

export const LemonSqueezyWebhookEvent = v.object({
    eventId: v.string(),
    eventName: v.string(),
    userId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    processedAt: v.number()
})
