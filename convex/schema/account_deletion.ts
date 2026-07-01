import { v } from "convex/values"

export const IdentitySuppression = v.object({
    googleSubHash: v.optional(v.string()),
    emailHash: v.string(),
    freeAnchorAt: v.number(),
    freePeriodKey: v.string(),
    freePeriodEndsAt: v.number(),
    freeConsumedBasicUnits: v.number(),
    everWasPro: v.boolean(),
    proEntitlementEndsAt: v.optional(v.number()),
    proPeriodKey: v.optional(v.string()),
    proConsumedBasicUnits: v.optional(v.number()),
    proConsumedProUnits: v.optional(v.number()),
    lemonSqueezyCustomerId: v.optional(v.string()),
    lemonSqueezySubscriptionId: v.optional(v.string()),
    refundCount: v.number(),
    relinkedToUserId: v.optional(v.string()),
    priorDeletions: v.number(),
    firstDeletedAt: v.number(),
    lastDeletedAt: v.number(),
    supersededBy: v.optional(v.id("identitySuppressions"))
})

export const BillingSubscriptionLink = v.object({
    lemonSqueezySubscriptionId: v.string(),
    lemonSqueezyCustomerId: v.optional(v.string()),
    liveUserId: v.optional(v.string()),
    suppressionId: v.optional(v.id("identitySuppressions")),
    status: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
    renewsAt: v.optional(v.string()),
    endsAt: v.optional(v.string()),
    trialEndsAt: v.optional(v.string()),
    lastEventId: v.optional(v.string()),
    updatedAt: v.number()
})

export const AccountDeletionJob = v.object({
    userId: v.string(),
    status: v.union(
        v.literal("pending"),
        v.literal("purging"),
        v.literal("completed"),
        v.literal("failed")
    ),
    suppressionId: v.optional(v.id("identitySuppressions")),
    phase: v.optional(v.string()),
    error: v.optional(v.string()),
    confirmationPhrase: v.optional(v.string()),
    consentPermanentErasureAccepted: v.optional(v.boolean()),
    consentFraudPreventionRetentionAccepted: v.optional(v.boolean()),
    consentAcceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
})
