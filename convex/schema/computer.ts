import { v } from "convex/values"

export const ComputerStatus = v.union(
    v.literal("provisioning"),
    v.literal("ready"),
    v.literal("archived"),
    v.literal("deleting")
)

export const ComputerOperation = v.union(
    v.literal("sleep"),
    v.literal("restart"),
    v.literal("reset"),
    v.literal("archive")
)

export const Computer = v.object({
    userId: v.string(),
    authUserId: v.string(),
    displayName: v.optional(v.string()),
    sandboxName: v.string(),
    driveName: v.string(),
    // Fixed when the Drive is created. Absent on the earliest computers.
    driveMaxBytes: v.optional(v.number()),
    status: ComputerStatus,
    sessionState: v.optional(
        v.union(
            v.literal("running"),
            v.literal("stopping"),
            v.literal("stopped"),
            v.literal("stuck")
        )
    ),
    operation: v.optional(ComputerOperation),
    activityLeaseId: v.optional(v.string()),
    executionInProgress: v.optional(v.boolean()),
    scheduledIdleStopId: v.optional(v.id("_scheduled_functions")),
    billingMessageKey: v.optional(v.string()),
    billingStartedAt: v.optional(v.number()),
    reservedMicrousd: v.optional(v.number()),
    deletionWarningsSent: v.optional(v.number()),
    // Files can't change while it sleeps, so a reading taken at sleep stays accurate.
    driveUsedBytes: v.optional(v.number()),
    snapshotBytes: v.optional(v.number()),
    storageMeasuredAt: v.optional(v.number()),
    storageChargedAt: v.optional(v.number()),
    overLimitSince: v.optional(v.number()),
    overLimitWarningsSent: v.optional(v.number()),
    keysChangedAt: v.optional(v.number()),
    keysAppliedAt: v.optional(v.number()),
    // Lets a setup that dies part way still resolve the card the user is looking at.
    setupCard: v.optional(
        v.object({
            threadId: v.id("threads"),
            messageId: v.string(),
            toolCallId: v.string(),
            cardId: v.string()
        })
    ),
    lastUsedAt: v.number(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
})
