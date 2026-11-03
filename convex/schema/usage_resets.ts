import { v } from "convex/values"
import { PrototypeCreditPlan } from "./credits"

export const UsageResetWindow = v.union(
    v.literal("five_hour"),
    v.literal("weekly"),
    v.literal("monthly")
)

export const UsageResetDelivery = v.union(v.literal("instant"), v.literal("banked"))

export const UsageResetScope = v.union(v.literal("user"), v.literal("global"))

// A reset is a breakpoint: usage before it stops counting. Weekly resets forgive a
// fraction of the monthly limit instead of everything before the breakpoint.
export const UsageResetGrant = v.object({
    scope: UsageResetScope,
    // App user ID for user-scoped grants.
    userId: v.optional(v.string()),
    // Global grants only. Unset means every plan.
    plan: v.optional(PrototypeCreditPlan),
    // Global grants only: users who signed up at or before this time.
    signedUpBefore: v.optional(v.number()),
    delivery: UsageResetDelivery,
    window: UsageResetWindow,
    // Weekly and monthly resets can also restart the 5-hour window.
    includesFiveHour: v.boolean(),
    // Weekly only: the share of the monthly limit forgiven.
    fraction: v.optional(v.number()),
    // Banked only. Unset means the ticket never expires.
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    note: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number()
})

export const UsageResetRedemption = v.object({
    grantId: v.id("usageResetGrants"),
    userId: v.string(),
    redeemedAt: v.number()
})
