import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import { getUserCreditPlan, recordStorageUsage } from "./credits"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import {
    COMPUTER_ARCHIVE_AFTER_MS,
    COMPUTER_DEFAULT_NAME,
    COMPUTER_DELETE_AFTER_MS,
    COMPUTER_DELETION_WARNING_DAYS,
    COMPUTER_DRIVE_CEILING_BYTES,
    COMPUTER_MAX_NAME_LENGTH,
    COMPUTER_OVER_LIMIT_PURGE_AFTER_MS,
    COMPUTER_OVER_LIMIT_WARNING_DAYS,
    COMPUTER_SESSION_TIMEOUT_MS,
    COMPUTER_STALE_OPERATION_MS,
    COMPUTER_STALE_PROVISIONING_MS,
    getComputerViewState
} from "./lib/computer_policy"
import { getUserIdentity } from "./lib/identity"
import {
    accrueComputerStorageMicrousd,
    estimateComputerStorageMonthlyMicrousd,
    getComputerStorageLimits
} from "./lib/sandbox_billing"
import { getConfiguredHostedUsageLimits } from "./lib/usage_metering"
import { ComputerOperation } from "./schema/computer"

const REQUEST_TOOL_NAME = "request_computer"
const REQUEST_KIND = "computer_request"
const STORAGE_CHARGE_PAGE_SIZE = 50
const RECONCILE_PAGE_SIZE = 50
const OVER_LIMIT_PAGE_SIZE = 200
const COMPUTER_OPERATIONS = ["sleep", "restart", "reset", "archive"] as const

type CardIdentifiers = {
    threadId: Id<"threads">
    messageId: string
    toolCallId: string
    cardId: string
}

const getComputer = (ctx: Pick<QueryCtx, "db">, userId: string) =>
    ctx.db
        .query("computers")
        .withIndex("byUserId", (q) => q.eq("userId", userId))
        .first()

const findCardMessage = async (ctx: Pick<QueryCtx, "db">, args: CardIdentifiers) => {
    const messages = await ctx.db
        .query("messages")
        .withIndex("byMessageId", (q) => q.eq("messageId", args.messageId))
        .collect()
    return messages.find(
        (candidate) => candidate.threadId === args.threadId && candidate.role === "assistant"
    )
}

const isRequestCardPart = (
    part: Doc<"messages">["parts"][number],
    { toolCallId, cardId }: Pick<CardIdentifiers, "toolCallId" | "cardId">
) =>
    part.type === "tool-invocation" &&
    part.toolInvocation.toolName === REQUEST_TOOL_NAME &&
    part.toolInvocation.toolCallId === toolCallId &&
    part.toolInvocation.state === "result" &&
    typeof part.toolInvocation.result === "object" &&
    part.toolInvocation.result !== null &&
    (part.toolInvocation.result as Record<string, unknown>).kind === REQUEST_KIND &&
    (part.toolInvocation.result as Record<string, unknown>).cardId === cardId

const findRequestCard = async (
    ctx: Pick<QueryCtx, "db">,
    args: CardIdentifiers & { userId: string }
) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.authorId !== args.userId) return null
    const message = await findCardMessage(ctx, args)
    const part = message?.parts.find((candidate) => isRequestCardPart(candidate, args))
    if (!message || part?.type !== "tool-invocation") return null
    return { message, result: part.toolInvocation.result as Record<string, unknown> }
}

const patchRequestCard = async (
    ctx: Pick<MutationCtx, "db">,
    message: Doc<"messages">,
    identifiers: Pick<CardIdentifiers, "toolCallId" | "cardId">,
    update: Record<string, unknown>
) => {
    const parts = message.parts.map((part) =>
        part.type === "tool-invocation" && isRequestCardPart(part, identifiers)
            ? {
                  ...part,
                  toolInvocation: {
                      ...part.toolInvocation,
                      result: {
                          ...(part.toolInvocation.result as Record<string, unknown>),
                          ...update
                      }
                  }
              }
            : part
    )
    await ctx.db.patch(message._id, { parts, updatedAt: Date.now() })
}

const getStorageMonthlyMicrousd = (computer: Doc<"computers">) =>
    estimateComputerStorageMonthlyMicrousd({
        driveBytes: computer.driveUsedBytes ?? 0,
        snapshotBytes: computer.snapshotBytes ?? 0
    })

const getPlanStorage = async (ctx: QueryCtx, userId: string) => {
    const { monthlyMicrousd } = getConfiguredHostedUsageLimits(await getUserCreditPlan(ctx, userId))
    return {
        allowanceMicrousd: monthlyMicrousd,
        driveLimitBytes: getComputerStorageLimits(monthlyMicrousd).driveLimitBytes
    }
}

/** Plans change at any time, so this reads the limit live rather than trusting the countdown. */
const isOverLimit = (computer: Doc<"computers">, driveLimitBytes: number) =>
    computer.overLimitSince !== undefined && (computer.driveUsedBytes ?? 0) > driveLimitBytes

const getOverLimitPatch = (computer: Doc<"computers">, usedBytes: number, limitBytes: number) => {
    if (usedBytes <= limitBytes) {
        return { overLimitSince: undefined, overLimitWarningsSent: undefined }
    }
    return computer.overLimitSince === undefined
        ? { overLimitSince: Date.now(), overLimitWarningsSent: 0 }
        : {}
}

const isRequestExpired = (result: Record<string, unknown>) =>
    typeof result.confirmationExpiresAt === "number" && result.confirmationExpiresAt <= Date.now()

export const getMyComputer = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null
        const computer = await getComputer(ctx, user.id)
        if (!computer) return null
        const { allowanceMicrousd, driveLimitBytes } = await getPlanStorage(ctx, user.id)
        return {
            _id: computer._id,
            name: computer.displayName ?? COMPUTER_DEFAULT_NAME,
            state: getComputerViewState(computer),
            operation: computer.operation,
            lastUsedAt: computer.lastUsedAt,
            deletesAt: computer.lastUsedAt + COMPUTER_DELETE_AFTER_MS,
            archivesAt: computer.lastUsedAt + COMPUTER_ARCHIVE_AFTER_MS,
            driveLimitBytes,
            overLimitDeletesAt: isOverLimit(computer, driveLimitBytes)
                ? (computer.overLimitSince as number) + COMPUTER_OVER_LIMIT_PURGE_AFTER_MS
                : null,
            storage:
                computer.storageMeasuredAt === undefined
                    ? null
                    : {
                          usedBytes: computer.driveUsedBytes ?? 0,
                          monthlyMicrousd: getStorageMonthlyMicrousd(computer),
                          allowanceMicrousd
                      }
        }
    }
})

export const getComputerCardResult = query({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null
        const card = await findRequestCard(ctx, { ...args, userId: user.id })
        return card?.result ?? null
    }
})

export const getComputerForUser = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => await getComputer(ctx, userId)
})

export const renameMyComputer = mutation({
    args: { name: v.string() },
    handler: async (ctx, { name }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized")
        await assertAccountNotDeleting(ctx, user.id)
        const trimmed = name.trim()
        if (!trimmed || trimmed.length > COMPUTER_MAX_NAME_LENGTH) {
            throw new ConvexError(`Names can be up to ${COMPUTER_MAX_NAME_LENGTH} characters`)
        }
        const computer = await getComputer(ctx, user.id)
        if (!computer) throw new ConvexError("Silky's computer isn't set up yet")
        await ctx.db.patch(computer._id, { displayName: trimmed, updatedAt: Date.now() })
    }
})

export const denyComputerRequest = mutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized")
        const card = await findRequestCard(ctx, { ...args, userId: user.id })
        if (!card || card.result.status !== "pending_confirmation") {
            throw new ConvexError("This request is no longer waiting for an answer")
        }
        await patchRequestCard(ctx, card.message, args, { status: "denied" })
    }
})

export const claimComputerRequest = internalMutation({
    args: {
        userId: v.string(),
        authUserId: v.string(),
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string(),
        sandboxName: v.string(),
        driveName: v.string()
    },
    handler: async (ctx, args) => {
        const card = await findRequestCard(ctx, args)
        if (!card || card.result.status !== "pending_confirmation") {
            return { ok: false as const, error: "This request is no longer waiting for an answer" }
        }
        if (isRequestExpired(card.result)) {
            await patchRequestCard(ctx, card.message, args, { status: "expired" })
            return { ok: false as const, error: "This request has expired" }
        }
        if (await getComputer(ctx, args.userId)) {
            await patchRequestCard(ctx, card.message, args, { status: "ready" })
            return { ok: false as const, error: "Silky's computer is already set up" }
        }

        const now = Date.now()
        const computerId = await ctx.db.insert("computers", {
            userId: args.userId,
            authUserId: args.authUserId,
            sandboxName: args.sandboxName,
            driveName: args.driveName,
            driveMaxBytes: COMPUTER_DRIVE_CEILING_BYTES,
            setupCard: {
                threadId: args.threadId,
                messageId: args.messageId,
                toolCallId: args.toolCallId,
                cardId: args.cardId
            },
            status: "provisioning",
            lastUsedAt: now,
            createdAt: now,
            updatedAt: now
        })
        await patchRequestCard(ctx, card.message, args, { status: "provisioning" })
        const record = await ctx.db.get(computerId)
        if (!record) throw new Error("Failed to create computer record")
        return { ok: true as const, record }
    }
})

export const finishComputerRequest = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string(),
        status: v.union(v.literal("ready"), v.literal("failed")),
        error: v.optional(v.string())
    },
    handler: async (ctx, { status, error, ...identifiers }) => {
        const message = await findCardMessage(ctx, identifiers)
        if (message) await patchRequestCard(ctx, message, identifiers, { status, error })
    }
})

export const markComputerReady = internalMutation({
    args: {
        computerId: v.id("computers"),
        activityLeaseId: v.string(),
        scheduledIdleStopId: v.optional(v.id("_scheduled_functions"))
    },
    handler: async (ctx, args) => {
        const now = Date.now()
        await ctx.db.patch(args.computerId, {
            status: "ready",
            sessionState: "running",
            activityLeaseId: args.activityLeaseId,
            scheduledIdleStopId: args.scheduledIdleStopId,
            archivedAt: undefined,
            setupCard: undefined,
            updatedAt: now
        })
    }
})

export const setComputerBilling = internalMutation({
    args: {
        computerId: v.id("computers"),
        billingMessageKey: v.string(),
        billingStartedAt: v.number(),
        reservedMicrousd: v.number()
    },
    handler: async (ctx, { computerId, ...billing }) => {
        await ctx.db.patch(computerId, { ...billing, updatedAt: Date.now() })
    }
})

export const clearComputerBilling = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        await ctx.db.patch(computerId, {
            billingMessageKey: undefined,
            billingStartedAt: undefined,
            reservedMicrousd: undefined,
            updatedAt: Date.now()
        })
    }
})

export const recordComputerStorage = internalMutation({
    args: {
        computerId: v.id("computers"),
        driveUsedBytes: v.optional(v.number()),
        snapshotBytes: v.optional(v.number())
    },
    handler: async (ctx, { computerId, driveUsedBytes, snapshotBytes }) => {
        const computer = await ctx.db.get(computerId)
        if (!computer) return
        const { driveLimitBytes } = await getPlanStorage(ctx, computer.userId)
        await ctx.db.patch(computerId, {
            ...(driveUsedBytes === undefined
                ? {}
                : getOverLimitPatch(computer, driveUsedBytes, driveLimitBytes)),
            driveUsedBytes: driveUsedBytes ?? computer.driveUsedBytes,
            snapshotBytes: snapshotBytes ?? computer.snapshotBytes,
            storageMeasuredAt:
                driveUsedBytes === undefined ? computer.storageMeasuredAt : Date.now()
        })
    }
})

export const markComputerKeysApplied = internalMutation({
    args: { computerId: v.id("computers"), appliedAt: v.number() },
    handler: async (ctx, { computerId, appliedAt }) => {
        if (await ctx.db.get(computerId)) {
            await ctx.db.patch(computerId, { keysAppliedAt: appliedAt })
        }
    }
})

export const beginComputerExecution = internalMutation({
    args: { userId: v.string(), activityLeaseId: v.string() },
    handler: async (ctx, { userId, activityLeaseId }) => {
        const computer = await getComputer(ctx, userId)
        if (!computer) return { ok: false as const, reason: "missing" as const }
        if (computer.status === "provisioning" || computer.status === "deleting") {
            return { ok: false as const, reason: "unavailable" as const }
        }
        if (
            computer.executionInProgress ||
            computer.operation ||
            computer.sessionState === "stopping"
        ) {
            return { ok: false as const, reason: "busy" as const }
        }
        const now = Date.now()
        await ctx.db.patch(computer._id, {
            activityLeaseId,
            executionInProgress: true,
            scheduledIdleStopId: undefined,
            deletionWarningsSent: 0,
            lastUsedAt: now,
            updatedAt: now
        })
        return { ok: true as const, record: computer }
    }
})

export const finishComputerExecution = internalMutation({
    args: {
        computerId: v.id("computers"),
        activityLeaseId: v.string(),
        scheduledIdleStopId: v.optional(v.id("_scheduled_functions")),
        stuck: v.optional(v.boolean())
    },
    handler: async (ctx, args) => {
        const computer = await ctx.db.get(args.computerId)
        if (!computer || computer.activityLeaseId !== args.activityLeaseId) return false
        const now = Date.now()
        await ctx.db.patch(computer._id, {
            executionInProgress: false,
            scheduledIdleStopId: args.scheduledIdleStopId,
            sessionState: args.stuck ? "stuck" : "running",
            lastUsedAt: now,
            updatedAt: now
        })
        return true
    }
})

export const claimComputerIdleStop = internalMutation({
    args: { computerId: v.id("computers"), activityLeaseId: v.string() },
    handler: async (ctx, args) => {
        const computer = await ctx.db.get(args.computerId)
        if (
            !computer ||
            computer.status !== "ready" ||
            computer.activityLeaseId !== args.activityLeaseId ||
            computer.executionInProgress ||
            computer.operation ||
            computer.sessionState !== "running"
        ) {
            return null
        }
        await ctx.db.patch(computer._id, {
            sessionState: "stopping",
            scheduledIdleStopId: undefined,
            updatedAt: Date.now()
        })
        return computer
    }
})

export const markComputerStopped = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        const computer = await ctx.db.get(computerId)
        if (!computer) return
        await ctx.db.patch(computerId, {
            sessionState: "stopped",
            operation: undefined,
            executionInProgress: false,
            scheduledIdleStopId: undefined,
            updatedAt: Date.now()
        })
    }
})

/** Claims the computer for a user action, which takes over from any running command. */
export const claimComputerOperation = internalMutation({
    args: { userId: v.string(), operation: ComputerOperation },
    handler: async (ctx, { userId, operation }) => {
        const computer = await getComputer(ctx, userId)
        if (!computer || computer.status === "provisioning" || computer.status === "deleting") {
            return null
        }
        if (computer.operation) return null
        if (computer.status === "archived" && operation !== "reset") return null
        await ctx.db.patch(computer._id, {
            operation,
            activityLeaseId: crypto.randomUUID(),
            executionInProgress: false,
            scheduledIdleStopId: undefined,
            updatedAt: Date.now()
        })
        return computer
    }
})

export const releaseComputerOperation = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        const computer = await ctx.db.get(computerId)
        if (computer) {
            await ctx.db.patch(computerId, { operation: undefined, updatedAt: Date.now() })
        }
    }
})

export const claimComputerArchive = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        const computer = await ctx.db.get(computerId)
        if (
            !computer ||
            computer.status !== "ready" ||
            computer.operation ||
            computer.executionInProgress ||
            computer.lastUsedAt > Date.now() - COMPUTER_ARCHIVE_AFTER_MS
        ) {
            return null
        }
        await ctx.db.patch(computerId, { operation: "archive", updatedAt: Date.now() })
        return computer
    }
})

export const markComputerArchived = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        const now = Date.now()
        await ctx.db.patch(computerId, {
            status: "archived",
            sessionState: undefined,
            operation: undefined,
            snapshotBytes: 0,
            archivedAt: now,
            deletionWarningsSent: 0,
            updatedAt: now
        })
    }
})

export const recordComputerDeletionWarning = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        const computer = await ctx.db.get(computerId)
        if (!computer) return
        await ctx.db.patch(computerId, {
            deletionWarningsSent: Math.min(
                COMPUTER_DELETION_WARNING_DAYS.length,
                (computer.deletionWarningsSent ?? 0) + 1
            ),
            updatedAt: Date.now()
        })
    }
})

export const claimComputerDeletion = internalMutation({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const computer = await getComputer(ctx, userId)
        if (!computer) return null
        await ctx.db.patch(computer._id, {
            status: "deleting",
            activityLeaseId: crypto.randomUUID(),
            executionInProgress: false,
            updatedAt: Date.now()
        })
        return computer
    }
})

export const removeComputerRecord = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        if (await ctx.db.get(computerId)) await ctx.db.delete(computerId)
    }
})

/** Charges for storage since the last run, a page at a time so it scales with the user count. */
export const chargeComputerStorage = internalMutation({
    args: { cursor: v.optional(v.string()) },
    handler: async (ctx, { cursor }): Promise<void> => {
        const now = Date.now()
        const page = await ctx.db
            .query("computers")
            .paginate({ cursor: cursor ?? null, numItems: STORAGE_CHARGE_PAGE_SIZE })
        for (const computer of page.page) {
            if (computer.status === "provisioning" || computer.status === "deleting") continue
            if (computer.storageMeasuredAt === undefined) continue
            // A plan change moves the limit without any new reading.
            const { driveLimitBytes } = await getPlanStorage(ctx, computer.userId)
            await ctx.db.patch(
                computer._id,
                getOverLimitPatch(computer, computer.driveUsedBytes ?? 0, driveLimitBytes)
            )
            const chargedFrom = computer.storageChargedAt ?? computer.storageMeasuredAt
            const amountMicrousd = accrueComputerStorageMicrousd(
                getStorageMonthlyMicrousd(computer),
                now - chargedFrom
            )
            // A tiny amount rounds to nothing, so let it build up until it's worth a charge.
            if (amountMicrousd <= 0) continue
            await recordStorageUsage(ctx, {
                userId: computer.userId,
                messageKey: `computer-storage:${computer._id}:${now}`,
                amountMicrousd,
                now
            })
            await ctx.db.patch(computer._id, { storageChargedAt: now })
        }
        if (!page.isDone) {
            await ctx.scheduler.runAfter(0, internal.computers.chargeComputerStorage, {
                cursor: page.continueCursor
            })
        }
    }
})

export const getComputerOverLimitNotice = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const computer = await getComputer(ctx, userId)
        if (!computer) return null
        const { driveLimitBytes } = await getPlanStorage(ctx, userId)
        if (!isOverLimit(computer, driveLimitBytes)) return null
        return {
            usedBytes: computer.driveUsedBytes ?? 0,
            limitBytes: driveLimitBytes,
            deletesAt: (computer.overLimitSince as number) + COMPUTER_OVER_LIMIT_PURGE_AFTER_MS
        }
    }
})

/** Re-checks each one against its current plan, so an upgrade stops a purge straight away. */
export const listComputersOverLimit = internalQuery({
    args: {},
    handler: async (ctx) => {
        const computers = await ctx.db
            .query("computers")
            .withIndex("byOverLimitSince", (q) => q.gt("overLimitSince", 0))
            .take(OVER_LIMIT_PAGE_SIZE)
        const overLimit: Doc<"computers">[] = []
        for (const computer of computers) {
            if (computer.status !== "ready" && computer.status !== "archived") continue
            const { driveLimitBytes } = await getPlanStorage(ctx, computer.userId)
            if (isOverLimit(computer, driveLimitBytes)) overLimit.push(computer)
        }
        return overLimit
    }
})

export const recordComputerOverLimitWarning = internalMutation({
    args: { computerId: v.id("computers") },
    handler: async (ctx, { computerId }) => {
        const computer = await ctx.db.get(computerId)
        if (!computer) return
        await ctx.db.patch(computerId, {
            overLimitWarningsSent: Math.min(
                COMPUTER_OVER_LIMIT_WARNING_DAYS.length,
                (computer.overLimitWarningsSent ?? 0) + 1
            )
        })
    }
})

export const listComputersForRetention = internalQuery({
    args: { now: v.number() },
    handler: async (ctx, { now }) => {
        const [ready, archived] = await Promise.all([
            ctx.db
                .query("computers")
                .withIndex("byStatusAndLastUsedAt", (q) =>
                    q.eq("status", "ready").lt("lastUsedAt", now - COMPUTER_ARCHIVE_AFTER_MS)
                )
                .take(50),
            ctx.db
                .query("computers")
                .withIndex("byStatusAndLastUsedAt", (q) => q.eq("status", "archived"))
                .take(200)
        ])
        return [...ready, ...archived]
    }
})

/**
 * Records left mid-flight by an action that died: a session past its timeout, or a stale lock.
 * Each state has its own index, so a healthy majority can't crowd the stuck ones out of a page.
 */
export const listComputersNeedingReconcile = internalQuery({
    args: { now: v.number() },
    handler: async (ctx, { now }) => {
        const sessionCutoff = now - COMPUTER_SESSION_TIMEOUT_MS
        const lockCutoff = now - COMPUTER_STALE_OPERATION_MS
        const pages = await Promise.all([
            ...(["running", "stopping", "stuck"] as const).map((sessionState) =>
                ctx.db
                    .query("computers")
                    .withIndex("bySessionStateAndUpdatedAt", (q) =>
                        q.eq("sessionState", sessionState).lt("updatedAt", sessionCutoff)
                    )
                    .take(RECONCILE_PAGE_SIZE)
            ),
            ctx.db
                .query("computers")
                .withIndex("byExecutionAndUpdatedAt", (q) =>
                    q.eq("executionInProgress", true).lt("updatedAt", lockCutoff)
                )
                .take(RECONCILE_PAGE_SIZE),
            ...COMPUTER_OPERATIONS.map((operation) =>
                ctx.db
                    .query("computers")
                    .withIndex("byOperationAndUpdatedAt", (q) =>
                        q.eq("operation", operation).lt("updatedAt", lockCutoff)
                    )
                    .take(RECONCILE_PAGE_SIZE)
            )
        ])
        const [provisioning, deleting] = await Promise.all([
            ctx.db
                .query("computers")
                .withIndex("byStatusAndLastUsedAt", (q) =>
                    q
                        .eq("status", "provisioning")
                        .lt("lastUsedAt", now - COMPUTER_STALE_PROVISIONING_MS)
                )
                .take(25),
            ctx.db
                .query("computers")
                .withIndex("byStatusAndLastUsedAt", (q) => q.eq("status", "deleting"))
                .take(25)
        ])
        const stale = new Map(
            pages
                .flat()
                .filter(({ status }) => status === "ready" || status === "archived")
                .map((computer) => [computer._id, computer])
        )
        return { stale: [...stale.values()], abandoned: [...provisioning, ...deleting] }
    }
})
