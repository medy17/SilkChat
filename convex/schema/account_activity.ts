import { v } from "convex/values"

export const AccountActivity = {
    authUserId: v.string(),
    lastActiveAt: v.number(),
    inactivityNoticeState: v.union(
        v.literal("pending"),
        v.literal("queued"),
        v.literal("sent"),
        v.literal("skipped")
    ),
    inactivityNoticeQueuedAt: v.optional(v.number()),
    inactivityNoticeSentAt: v.optional(v.number()),
    inactivityNoticeSkippedAt: v.optional(v.number()),
    inactivityNoticeSkipReason: v.optional(v.string()),
    inactivityNoticeDeliveryAttempts: v.optional(v.number())
}
