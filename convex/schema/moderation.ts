import { v } from "convex/values"

export const ModerationActionValidator = v.union(
    v.literal("warning"),
    v.literal("strike"),
    v.literal("suspension"),
    v.literal("ban")
)

export const ModerationCase = v.object({
    // Human-readable ID quoted in emails, appeals and the Safety page.
    caseId: v.string(),
    userId: v.string(),
    authUserId: v.string(),
    action: ModerationActionValidator,
    category: v.string(),
    violation: v.string(),
    policyReference: v.optional(v.string()),
    contentAction: v.optional(v.string()),
    // Operator-only fields. Never return these from user-facing queries.
    internalNote: v.optional(v.string()),
    recipientEmail: v.string(),
    recipientName: v.optional(v.string()),
    createdBy: v.string(),
    strikeNumber: v.optional(v.number()),
    strikeLimit: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("overturned"), v.literal("lifted")),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    emailStatus: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    emailAttempts: v.optional(v.number()),
    emailError: v.optional(v.string()),
    emailSentAt: v.optional(v.number()),
    // Suspensions and bans only. The email promises cancellation, so it waits for this.
    subscriptionCancellation: v.optional(
        v.union(v.literal("pending"), v.literal("done"), v.literal("failed"))
    ),
    // Warnings and strikes only: when the user dismissed the in-app notice.
    acknowledgedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
})

const DeliveryStatus = v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"))

export const ModerationCaseUpdateKind = v.union(
    v.literal("appeal_denied"),
    v.literal("overturned"),
    v.literal("lifted"),
    v.literal("shortened"),
    v.literal("extended")
)

// A change to an existing case. Each one emails the user once.
export const ModerationCaseUpdate = v.object({
    caseId: v.id("moderationCases"),
    kind: ModerationCaseUpdateKind,
    viaAppeal: v.optional(v.boolean()),
    note: v.optional(v.string()),
    // Shortened or extended only: the new expiry or end date.
    newEnd: v.optional(v.number()),
    // The user can sign in again because no other suspension or ban remains.
    restoresAccess: v.optional(v.boolean()),
    createdBy: v.string(),
    createdAt: v.number(),
    emailStatus: DeliveryStatus,
    emailAttempts: v.optional(v.number()),
    emailError: v.optional(v.string()),
    emailSentAt: v.optional(v.number())
})

export const ModerationAppeal = v.object({
    caseId: v.id("moderationCases"),
    userId: v.string(),
    message: v.string(),
    status: v.union(v.literal("pending"), v.literal("upheld"), v.literal("overturned")),
    decisionNote: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number()
})

// An account that needs an operator's attention, shown under Priority. Opened when a strike
// reaches the strike limit. Resolved when the account is suspended or banned, or when an
// overturn drops it back under the limit.
export const ModerationEscalation = v.object({
    authUserId: v.string(),
    reason: v.literal("strike_limit"),
    // The case that triggered it, e.g. the strike that reached the limit.
    caseId: v.id("moderationCases"),
    status: v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed")),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number()
})

// Blocks new sign-ups from a permanently banned email. Stores a peppered hash, not the address.
export const ModerationIdentityBlock = v.object({
    emailHash: v.string(),
    caseId: v.id("moderationCases"),
    createdAt: v.number()
})
