import { v } from "convex/values"

export const PersistentSandboxStatus = v.union(
    v.literal("provisioning"),
    v.literal("active"),
    v.literal("stopping"),
    v.literal("stopped"),
    v.literal("expired"),
    v.literal("failed"),
    v.literal("denied")
)

export const PersistentSandbox = v.object({
    userId: v.string(),
    sourceThreadId: v.id("threads"),
    sourceMessageId: v.string(),
    sourceToolCallId: v.string(),
    sourceCardId: v.string(),
    purpose: v.string(),
    ttlMinutes: v.number(),
    runtime: v.union(v.literal("node24"), v.literal("python3.13")),
    sandboxName: v.optional(v.string()),
    status: PersistentSandboxStatus,
    expiresAt: v.optional(v.number()),
    scheduledCleanupId: v.optional(v.id("_scheduled_functions")),
    scheduledIdleStopId: v.optional(v.id("_scheduled_functions")),
    activityLeaseId: v.optional(v.string()),
    lastActivityAt: v.optional(v.number()),
    executionInProgress: v.optional(v.boolean()),
    sessionState: v.optional(
        v.union(v.literal("running"), v.literal("stopping"), v.literal("stopped"))
    ),
    cleanupAttempts: v.optional(v.number()),
    billingMessageKey: v.optional(v.string()),
    reservedMicrousd: v.optional(v.number()),
    settledMicrousd: v.optional(v.number()),
    activeCpuDurationMs: v.optional(v.number()),
    provisionedMemoryGbMs: v.optional(v.number()),
    ingressBytes: v.optional(v.number()),
    egressBytes: v.optional(v.number()),
    snapshotByteMs: v.optional(v.number()),
    sessionCount: v.optional(v.number()),
    terminationReason: v.optional(
        v.union(v.literal("user"), v.literal("model"), v.literal("expired"))
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number())
})
