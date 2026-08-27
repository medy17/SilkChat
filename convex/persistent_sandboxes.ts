import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { getUserIdentity } from "./lib/identity"
import {
    MAX_PERSISTENT_SANDBOX_LIFETIME_MS,
    PERSISTENT_SANDBOX_CONFIRMATION_TTL_MS
} from "./lib/persistent_sandbox_policy"
import { parseSandboxRuntime, parseSandboxRuntimeVersion } from "./lib/sandbox_runtime"

export const PERSISTENT_SANDBOX_TTL_MINUTES = [3, 5, 10, 15, 30] as const

const ACTIVE_STATUSES = new Set(["provisioning", "active", "stopping"])
const REQUEST_TOOL_NAME = "request_persistent_sandbox"

const findRequestCard = async (
    ctx: Pick<MutationCtx, "db">,
    args: {
        userId: string
        threadId: Id<"threads">
        messageId: string
        toolCallId: string
        cardId: string
    }
) => {
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.authorId !== args.userId) return null

    const messages = await ctx.db
        .query("messages")
        .withIndex("byMessageId", (q) => q.eq("messageId", args.messageId))
        .collect()
    const message = messages.find(
        (candidate) => candidate.threadId === args.threadId && candidate.role === "assistant"
    )
    if (!message) return null

    const part = message.parts.find(
        (candidate) =>
            candidate.type === "tool-invocation" &&
            candidate.toolInvocation.toolName === REQUEST_TOOL_NAME &&
            candidate.toolInvocation.toolCallId === args.toolCallId &&
            candidate.toolInvocation.state === "result" &&
            typeof candidate.toolInvocation.result === "object" &&
            candidate.toolInvocation.result !== null &&
            (candidate.toolInvocation.result as Record<string, unknown>).kind ===
                "persistent_sandbox_request" &&
            (candidate.toolInvocation.result as Record<string, unknown>).cardId === args.cardId
    )
    if (!part || part.type !== "tool-invocation") return null

    const result = part.toolInvocation.result as Record<string, unknown>
    const ttlMinutes = Number(result.ttlMinutes)
    const purpose = typeof result.purpose === "string" ? result.purpose.trim() : ""
    const runtime = parseSandboxRuntime(result.runtime)
    const runtimeVersion = parseSandboxRuntimeVersion(result.runtimeVersion)
    if (
        !PERSISTENT_SANDBOX_TTL_MINUTES.includes(
            ttlMinutes as (typeof PERSISTENT_SANDBOX_TTL_MINUTES)[number]
        ) ||
        !purpose ||
        !runtime ||
        !runtimeVersion
    ) {
        return null
    }

    const requestedAt =
        typeof result.requestedAt === "number" ? result.requestedAt : message._creationTime
    const confirmationExpiresAt =
        typeof result.confirmationExpiresAt === "number"
            ? result.confirmationExpiresAt
            : requestedAt + PERSISTENT_SANDBOX_CONFIRMATION_TTL_MS

    return {
        message,
        part,
        result,
        ttlMinutes,
        purpose,
        runtime,
        runtimeVersion,
        confirmationExpiresAt
    }
}

const patchRequestCardInMessage = async (
    ctx: Pick<MutationCtx, "db">,
    message: Doc<"messages">,
    identifiers: { toolCallId: string; cardId: string },
    update: Record<string, unknown>
) => {
    let changed = false
    const parts = message.parts.map((part) => {
        if (
            part.type !== "tool-invocation" ||
            part.toolInvocation.toolName !== REQUEST_TOOL_NAME ||
            part.toolInvocation.toolCallId !== identifiers.toolCallId ||
            part.toolInvocation.state !== "result" ||
            typeof part.toolInvocation.result !== "object" ||
            part.toolInvocation.result === null ||
            (part.toolInvocation.result as Record<string, unknown>).cardId !== identifiers.cardId
        ) {
            return part
        }

        changed = true
        return {
            ...part,
            toolInvocation: {
                ...part.toolInvocation,
                result: {
                    ...(part.toolInvocation.result as Record<string, unknown>),
                    ...update
                }
            }
        }
    })

    if (changed) await ctx.db.patch(message._id, { parts, updatedAt: Date.now() })
}

const patchRequestCard = async (
    ctx: Pick<MutationCtx, "db">,
    record: Doc<"persistentSandboxes">,
    update: Record<string, unknown>
) => {
    const messages = await ctx.db
        .query("messages")
        .withIndex("byMessageId", (q) => q.eq("messageId", record.sourceMessageId))
        .collect()
    const message = messages.find((candidate) => candidate.threadId === record.sourceThreadId)
    if (!message) return

    await patchRequestCardInMessage(
        ctx,
        message,
        { toolCallId: record.sourceToolCallId, cardId: record.sourceCardId },
        update
    )
}

const getLatestActiveSandbox = async (ctx: Pick<QueryCtx, "db">, userId: string) => {
    const records = await ctx.db
        .query("persistentSandboxes")
        .withIndex("byUserIdAndUpdatedAt", (q) => q.eq("userId", userId))
        .order("desc")
        .take(20)
    return records.find((record) => ACTIVE_STATUSES.has(record.status))
}

export const getMyActivePersistentSandbox = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null
        const record = await getLatestActiveSandbox(ctx, user.id)
        if (!record) return null
        return {
            _id: record._id,
            status: record.status,
            runtime: record.runtime,
            runtimeVersion: record.runtimeVersion,
            expiresAt: record.expiresAt,
            sessionState: record.sessionState
        }
    }
})

export const getActivePersistentSandboxForUser = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => (await getLatestActiveSandbox(ctx, userId)) ?? null
})

export const getPersistentSandboxInternal = internalQuery({
    args: { sandboxId: v.id("persistentSandboxes") },
    handler: async (ctx, { sandboxId }) => await ctx.db.get(sandboxId)
})

export const listPersistentSandboxesNeedingCleanup = internalQuery({
    args: { now: v.number() },
    handler: async (ctx, { now }) => {
        const staleProvisioningCutoff = now - 2 * 60_000
        const hardLifetimeCutoff = now - MAX_PERSISTENT_SANDBOX_LIFETIME_MS
        const [pastRequestedTtl, pastGlobalLifetime, stopping, staleProvisioning] =
            await Promise.all([
                ctx.db
                    .query("persistentSandboxes")
                    .withIndex("byExpiresAt", (q) => q.lt("expiresAt", now))
                    .take(25),
                ctx.db
                    .query("persistentSandboxes")
                    .withIndex("byCreatedAt", (q) => q.lt("createdAt", hardLifetimeCutoff))
                    .take(25),
                ctx.db
                    .query("persistentSandboxes")
                    .withIndex("byStatusAndUpdatedAt", (q) => q.eq("status", "stopping"))
                    .take(25),
                ctx.db
                    .query("persistentSandboxes")
                    .withIndex("byStatusAndUpdatedAt", (q) =>
                        q.eq("status", "provisioning").lt("updatedAt", staleProvisioningCutoff)
                    )
                    .take(25)
            ])

        const candidates = new Map(
            [...pastRequestedTtl, ...pastGlobalLifetime, ...stopping, ...staleProvisioning].map(
                (record) => [record._id, record]
            )
        )
        return [...candidates.values()].filter((record) => ACTIVE_STATUSES.has(record.status))
    }
})

export const claimPersistentSandboxRequest = internalMutation({
    args: {
        userId: v.string(),
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string(),
        sandboxName: v.string()
    },
    handler: async (ctx, args) => {
        const existingCardRecord = await ctx.db
            .query("persistentSandboxes")
            .withIndex("bySourceCardId", (q) => q.eq("sourceCardId", args.cardId))
            .first()
        if (existingCardRecord) {
            return { ok: false as const, reason: "already_handled" as const, existingCardRecord }
        }

        const card = await findRequestCard(ctx, args)
        if (!card) {
            return { ok: false as const, reason: "invalid_card" as const }
        }
        if (card.confirmationExpiresAt <= Date.now()) {
            await patchRequestCardInMessage(
                ctx,
                card.message,
                { toolCallId: args.toolCallId, cardId: args.cardId },
                { status: "expired" }
            )
            return { ok: false as const, reason: "expired_card" as const }
        }
        if (card.result.status !== "pending_confirmation") {
            return { ok: false as const, reason: "invalid_card" as const }
        }

        const now = Date.now()
        const active = await getLatestActiveSandbox(ctx, args.userId)
        if (active) {
            if (
                active.status === "active" &&
                typeof active.expiresAt === "number" &&
                active.expiresAt <= now
            ) {
                await ctx.db.patch(active._id, {
                    status: "stopping",
                    terminationReason: "expired",
                    updatedAt: now
                })
                await patchRequestCard(ctx, active, { status: "stopping" })
                return { ok: false as const, reason: "expired_existing" as const, active }
            }
            return { ok: false as const, reason: "active_exists" as const, active }
        }

        const sandboxId = await ctx.db.insert("persistentSandboxes", {
            userId: args.userId,
            sourceThreadId: args.threadId,
            sourceMessageId: args.messageId,
            sourceToolCallId: args.toolCallId,
            sourceCardId: args.cardId,
            purpose: card.purpose,
            ttlMinutes: card.ttlMinutes,
            runtime: card.runtime,
            runtimeVersion: card.runtimeVersion,
            sandboxName: args.sandboxName,
            status: "provisioning",
            createdAt: now,
            updatedAt: now
        })
        const record = await ctx.db.get(sandboxId)
        if (!record) throw new Error("Failed to create persistent sandbox record")
        await patchRequestCard(ctx, record, {
            status: "provisioning",
            sandboxId
        })
        return { ok: true as const, record }
    }
})

export const markPersistentSandboxActive = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        expiresAt: v.number(),
        scheduledCleanupId: v.id("_scheduled_functions"),
        scheduledIdleStopId: v.id("_scheduled_functions"),
        activityLeaseId: v.string(),
        lastActivityAt: v.number()
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (!record || record.status !== "provisioning") return null
        const now = Date.now()
        await ctx.db.patch(record._id, {
            status: "active",
            expiresAt: args.expiresAt,
            scheduledCleanupId: args.scheduledCleanupId,
            scheduledIdleStopId: args.scheduledIdleStopId,
            activityLeaseId: args.activityLeaseId,
            lastActivityAt: args.lastActivityAt,
            executionInProgress: false,
            sessionState: "running",
            error: undefined,
            updatedAt: now
        })
        await patchRequestCard(ctx, record, {
            status: "active",
            sandboxId: record._id,
            expiresAt: args.expiresAt
        })
        return record._id
    }
})

export const markPersistentSandboxBillingReserved = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        billingMessageKey: v.string(),
        reservedMicrousd: v.number()
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (!record || record.status !== "provisioning") return false
        await ctx.db.patch(record._id, {
            billingMessageKey: args.billingMessageKey,
            reservedMicrousd: Math.max(0, Math.round(args.reservedMicrousd)),
            updatedAt: Date.now()
        })
        return true
    }
})

export const beginPersistentSandboxExecution = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        userId: v.string(),
        activityLeaseId: v.string(),
        now: v.number()
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (
            !record ||
            record.userId !== args.userId ||
            record.status !== "active" ||
            !record.expiresAt ||
            record.expiresAt <= args.now ||
            record.sessionState === "stopping"
        ) {
            return null
        }
        await ctx.db.patch(record._id, {
            activityLeaseId: args.activityLeaseId,
            lastActivityAt: args.now,
            scheduledIdleStopId: undefined,
            executionInProgress: true,
            sessionState: "running",
            updatedAt: args.now
        })
        return record
    }
})

export const finishPersistentSandboxExecution = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        activityLeaseId: v.string(),
        scheduledIdleStopId: v.optional(v.id("_scheduled_functions")),
        now: v.number()
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (
            !record ||
            record.status !== "active" ||
            record.activityLeaseId !== args.activityLeaseId
        ) {
            return false
        }
        await ctx.db.patch(record._id, {
            scheduledIdleStopId: args.scheduledIdleStopId,
            lastActivityAt: args.now,
            executionInProgress: false,
            sessionState: "running",
            updatedAt: args.now
        })
        return true
    }
})

export const claimPersistentSandboxIdleStop = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        activityLeaseId: v.string()
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (
            !record ||
            record.status !== "active" ||
            record.activityLeaseId !== args.activityLeaseId ||
            record.executionInProgress === true ||
            record.sessionState === "stopping" ||
            record.sessionState === "stopped"
        ) {
            return null
        }
        await ctx.db.patch(record._id, {
            scheduledIdleStopId: undefined,
            sessionState: "stopping",
            updatedAt: Date.now()
        })
        return record
    }
})

export const finalizePersistentSandboxIdleStop = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        activityLeaseId: v.string(),
        error: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (
            !record ||
            record.status !== "active" ||
            record.activityLeaseId !== args.activityLeaseId
        ) {
            return false
        }
        await ctx.db.patch(record._id, {
            sessionState: args.error ? "running" : "stopped",
            error: args.error,
            updatedAt: Date.now()
        })
        return true
    }
})

export const markPersistentSandboxProvisioningFailed = internalMutation({
    args: { sandboxId: v.id("persistentSandboxes"), error: v.string() },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (!record || record.status !== "provisioning") return null
        const now = Date.now()
        await ctx.db.patch(record._id, {
            status: "failed",
            error: args.error,
            completedAt: now,
            updatedAt: now
        })
        await patchRequestCard(ctx, record, { status: "failed", error: args.error })
        return record._id
    }
})

export const claimPersistentSandboxStop = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        userId: v.optional(v.string()),
        reason: v.union(v.literal("user"), v.literal("model"), v.literal("expired"))
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (!record || (args.userId && record.userId !== args.userId)) return null
        if (args.reason === "model" && record.executionInProgress === true) return null
        if (
            record.status === "stopped" ||
            record.status === "expired" ||
            record.status === "failed"
        ) {
            return null
        }
        const now = Date.now()
        if (record.status !== "stopping") {
            await ctx.db.patch(record._id, {
                status: "stopping",
                terminationReason: args.reason,
                updatedAt: now
            })
            await patchRequestCard(ctx, record, { status: "stopping" })
        }
        return { ...record, status: "stopping" as const, terminationReason: args.reason }
    }
})

export const finalizePersistentSandboxStop = internalMutation({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        reason: v.union(v.literal("user"), v.literal("model"), v.literal("expired")),
        settledMicrousd: v.optional(v.number()),
        activeCpuDurationMs: v.optional(v.number()),
        provisionedMemoryGbMs: v.optional(v.number()),
        ingressBytes: v.optional(v.number()),
        egressBytes: v.optional(v.number()),
        snapshotByteMs: v.optional(v.number()),
        creations: v.optional(v.number()),
        sessionCount: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (!record) return null
        const now = Date.now()
        const status = args.reason === "expired" ? "expired" : "stopped"
        await ctx.db.patch(record._id, {
            status,
            terminationReason: args.reason,
            error: undefined,
            settledMicrousd: args.settledMicrousd,
            activeCpuDurationMs: args.activeCpuDurationMs,
            provisionedMemoryGbMs: args.provisionedMemoryGbMs,
            ingressBytes: args.ingressBytes,
            egressBytes: args.egressBytes,
            snapshotByteMs: args.snapshotByteMs,
            creations: args.creations,
            sessionCount: args.sessionCount,
            completedAt: now,
            updatedAt: now
        })
        await patchRequestCard(ctx, record, { status, completedAt: now })
        return record._id
    }
})

export const markPersistentSandboxCleanupFailed = internalMutation({
    args: { sandboxId: v.id("persistentSandboxes"), error: v.string() },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.sandboxId)
        if (!record) return null
        await ctx.db.patch(record._id, {
            status: "stopping",
            cleanupAttempts: (record.cleanupAttempts ?? 0) + 1,
            error: args.error,
            updatedAt: Date.now()
        })
        await patchRequestCard(ctx, record, { status: "stopping", error: args.error })
        return record._id
    }
})

export const denyPersistentSandboxRequest = mutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized")
        await assertAccountNotDeleting(ctx, user.id)

        const existing = await ctx.db
            .query("persistentSandboxes")
            .withIndex("bySourceCardId", (q) => q.eq("sourceCardId", args.cardId))
            .first()
        if (existing) return { success: existing.status === "denied" }

        const card = await findRequestCard(ctx, { ...args, userId: user.id })
        if (!card) {
            throw new ConvexError("Persistent sandbox request is no longer awaiting confirmation")
        }
        if (card.confirmationExpiresAt <= Date.now()) {
            await patchRequestCardInMessage(
                ctx,
                card.message,
                { toolCallId: args.toolCallId, cardId: args.cardId },
                { status: "expired" }
            )
            throw new ConvexError("Persistent sandbox request has expired")
        }
        if (card.result.status !== "pending_confirmation") {
            throw new ConvexError("Persistent sandbox request is no longer awaiting confirmation")
        }

        const now = Date.now()
        const sandboxId = await ctx.db.insert("persistentSandboxes", {
            userId: user.id,
            sourceThreadId: args.threadId,
            sourceMessageId: args.messageId,
            sourceToolCallId: args.toolCallId,
            sourceCardId: args.cardId,
            purpose: card.purpose,
            ttlMinutes: card.ttlMinutes,
            runtime: card.runtime,
            runtimeVersion: card.runtimeVersion,
            status: "denied",
            createdAt: now,
            updatedAt: now,
            completedAt: now
        })
        const record = await ctx.db.get(sandboxId)
        if (record) await patchRequestCard(ctx, record, { status: "denied" })
        return { success: true }
    }
})
