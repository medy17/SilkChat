"use node"

import { Sandbox } from "@vercel/sandbox"
import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { type ActionCtx, action, internalAction } from "./_generated/server"
import { assertAccountNotDeletingForAction } from "./lib/account_deletion_gate"
import { getUserIdentity } from "./lib/identity"
import {
    MAX_PERSISTENT_SANDBOX_LIFETIME_MS,
    PERSISTENT_SANDBOX_IDLE_SUSPEND_MS,
    isPastPersistentSandboxLifetime
} from "./lib/persistent_sandbox_policy"
import {
    calculateSandboxUsageMicrousd,
    collectSandboxBillableUsage,
    estimatePersistentSandboxReservationMicrousd,
    sandboxSessionNeedsStop
} from "./lib/sandbox_billing"
import { isMissingSandboxError } from "./lib/sandbox_errors"
import { getVercelSandboxCredentials } from "./lib/tools/code_execution_node"

const SNAPSHOT_EXPIRATION_MS = 24 * 60 * 60 * 1000
const CLEANUP_RETRY_DELAY_MS = 30_000
const MAX_CLEANUP_ATTEMPTS = 5

const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Persistent sandbox operation failed"

const deleteVercelSandboxByName = async (sandboxName: string) => {
    const credentials = getVercelSandboxCredentials()
    if (!credentials) throw new Error("Vercel Sandbox is not configured")

    try {
        const sandbox = await Sandbox.get({
            ...credentials,
            name: sandboxName,
            resume: false
        })
        await sandbox.delete()
    } catch (error) {
        if (!isMissingSandboxError(error)) throw error
    }
}

const deleteVercelSandbox = async (record: Doc<"persistentSandboxes">) => {
    if (!record.sandboxName) return undefined
    const credentials = getVercelSandboxCredentials()
    if (!credentials) throw new Error("Vercel Sandbox is not configured")

    try {
        const sandbox = await Sandbox.get({
            ...credentials,
            name: record.sandboxName,
            resume: false
        })
        if (sandboxSessionNeedsStop(sandbox.status)) await sandbox.stop()
        const usage = await collectSandboxBillableUsage(sandbox)
        await sandbox.delete()
        return usage
    } catch (error) {
        if (isMissingSandboxError(error)) return undefined
        throw error
    }
}

const sweepOverageProviderSandboxes = async (now: number) => {
    const credentials = getVercelSandboxCredentials()
    if (!credentials) return { checked: 0, deleted: 0, failed: 0 }

    try {
        // Vercel's API currently rejects the SDK's tag-filter query with HTTP 400 for this
        // deployment, so list the project and apply the exact ownership tags locally.
        const listed = await Sandbox.list(credentials)

        const overdue: string[] = []
        let checked = 0
        for await (const sandbox of listed) {
            const tags = sandbox.tags ?? {}
            if (tags.app !== "silkchat" || tags.feature !== "persistent-code") continue
            checked += 1
            if (sandbox.persistent && isPastPersistentSandboxLifetime(sandbox.createdAt, now)) {
                overdue.push(sandbox.name)
            }
        }

        const results = await Promise.allSettled(overdue.map(deleteVercelSandboxByName))
        const failed = results.filter((result) => result.status === "rejected").length
        if (failed > 0) {
            console.error("Failed to delete overdue persistent sandboxes", { failed })
        }
        return { checked, deleted: results.length - failed, failed }
    } catch (error) {
        console.error("Failed to sweep overdue persistent sandboxes", error)
        return { checked: 0, deleted: 0, failed: 1 }
    }
}

const cleanupPersistentSandbox = async (
    ctx: ActionCtx,
    record: Doc<"persistentSandboxes">,
    reason: "user" | "model" | "expired"
) => {
    try {
        if (record.scheduledCleanupId) {
            await ctx.scheduler.cancel(record.scheduledCleanupId).catch(() => undefined)
        }
        if (record.scheduledIdleStopId) {
            await ctx.scheduler.cancel(record.scheduledIdleStopId).catch(() => undefined)
        }
        const usage = await deleteVercelSandbox(record)
        const settledMicrousd = usage
            ? calculateSandboxUsageMicrousd(usage)
            : record.reservedMicrousd
        if (record.billingMessageKey) {
            await ctx.runMutation(internal.credits.commitReservedCreditForMessage, {
                userId: record.userId,
                messageKey: record.billingMessageKey,
                threadId: record.sourceThreadId,
                messageId: record.sourceMessageId,
                settledMicrousd,
                pricingSource: "sandbox_reported"
            })
        }
        await ctx.runMutation(internal.persistent_sandboxes.finalizePersistentSandboxStop, {
            sandboxId: record._id,
            reason,
            settledMicrousd,
            ...(usage ?? {})
        })
        return { success: true as const }
    } catch (error) {
        const message = getErrorMessage(error)
        await ctx.runMutation(internal.persistent_sandboxes.markPersistentSandboxCleanupFailed, {
            sandboxId: record._id,
            error: message
        })
        if ((record.cleanupAttempts ?? 0) + 1 < MAX_CLEANUP_ATTEMPTS) {
            await ctx.scheduler.runAfter(
                CLEANUP_RETRY_DELAY_MS,
                internal.persistent_sandboxes_node.expirePersistentSandbox,
                { sandboxId: record._id }
            )
        }
        return { success: false as const, error: message }
    }
}

export const confirmPersistentSandboxRequest = action({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async (ctx, args): Promise<{ sandboxId: Id<"persistentSandboxes"> }> => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized")
        await assertAccountNotDeletingForAction(ctx, user.id)

        const claim = () =>
            ctx.runMutation(internal.persistent_sandboxes.claimPersistentSandboxRequest, {
                ...args,
                userId: user.id,
                sandboxName: `silkchat-${crypto.randomUUID()}`
            })

        let claimed = await claim()
        if (!claimed.ok && claimed.reason === "expired_existing") {
            const cleanup = await cleanupPersistentSandbox(ctx, claimed.active, "expired")
            if (!cleanup.success) throw new ConvexError(cleanup.error)
            claimed = await claim()
        }

        if (!claimed.ok) {
            if (claimed.reason === "expired_card") {
                throw new ConvexError("This persistent sandbox request has expired")
            }
            if (claimed.reason === "active_exists") {
                throw new ConvexError("Only one persistent sandbox can be active per account")
            }
            if (claimed.reason === "already_handled") {
                throw new ConvexError("This persistent sandbox request was already handled")
            }
            throw new ConvexError("Persistent sandbox request is no longer awaiting confirmation")
        }

        const record = claimed.record
        const credentials = getVercelSandboxCredentials()
        if (!credentials) {
            const error = "Vercel Sandbox is not configured"
            await ctx.runMutation(
                internal.persistent_sandboxes.markPersistentSandboxProvisioningFailed,
                { sandboxId: record._id, error }
            )
            throw new ConvexError(error)
        }

        const billingMessageKey = `persistent-sandbox:${record._id}`
        const reservedMicrousd = estimatePersistentSandboxReservationMicrousd({
            ttlMinutes: record.ttlMinutes,
            vcpus: 1
        })
        const billingReservation = await ctx.runMutation(internal.credits.reserveCreditForMessage, {
            userId: user.id,
            threadId: record.sourceThreadId,
            messageId: record.sourceMessageId,
            messageKey: billingMessageKey,
            providerSource: "internal",
            feature: "tool",
            counted: true,
            reservedMicrousd,
            pricingSource: "sandbox_estimate"
        })
        if (!billingReservation.allowed) {
            const error =
                billingReservation.reason === "usage"
                    ? "This persistent sandbox would exceed your current hosted usage limit"
                    : "Persistent sandbox billing could not be reserved"
            await ctx.runMutation(
                internal.persistent_sandboxes.markPersistentSandboxProvisioningFailed,
                { sandboxId: record._id, error }
            )
            throw new ConvexError(error)
        }
        const billingMarked = await ctx.runMutation(
            internal.persistent_sandboxes.markPersistentSandboxBillingReserved,
            { sandboxId: record._id, billingMessageKey, reservedMicrousd }
        )
        if (!billingMarked) {
            await ctx.runMutation(internal.credits.releaseReservedCreditForMessage, {
                userId: user.id,
                messageKey: billingMessageKey
            })
            throw new ConvexError("Persistent sandbox request was cancelled during provisioning")
        }

        let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined
        try {
            const ttlMs = record.ttlMinutes * 60_000
            const expiresAt = Date.now() + ttlMs
            sandbox = await Sandbox.create({
                ...credentials,
                name: record.sandboxName,
                runtime: record.runtime,
                resources: { vcpus: 1 },
                timeout: ttlMs,
                persistent: true,
                snapshotExpiration: SNAPSHOT_EXPIRATION_MS,
                keepLastSnapshots: { count: 1, expiration: SNAPSHOT_EXPIRATION_MS },
                networkPolicy: "allow-all",
                tags: {
                    app: "silkchat",
                    feature: "persistent-code",
                    record: record._id
                }
            })
            const scheduledCleanupId = await ctx.scheduler.runAt(
                expiresAt,
                internal.persistent_sandboxes_node.expirePersistentSandbox,
                { sandboxId: record._id }
            )
            const activityLeaseId = crypto.randomUUID()
            const lastActivityAt = Date.now()
            const scheduledIdleStopId = await ctx.scheduler.runAfter(
                PERSISTENT_SANDBOX_IDLE_SUSPEND_MS,
                internal.persistent_sandboxes_node.suspendIdlePersistentSandbox,
                { sandboxId: record._id, activityLeaseId }
            )
            const activated = await ctx.runMutation(
                internal.persistent_sandboxes.markPersistentSandboxActive,
                {
                    sandboxId: record._id,
                    expiresAt,
                    scheduledCleanupId,
                    scheduledIdleStopId,
                    activityLeaseId,
                    lastActivityAt
                }
            )
            if (!activated) {
                await ctx.scheduler.cancel(scheduledIdleStopId).catch(() => undefined)
                await ctx.scheduler.cancel(scheduledCleanupId).catch(() => undefined)
                await sandbox.delete().catch(() => undefined)
                throw new Error("Persistent sandbox request was cancelled during provisioning")
            }
            return { sandboxId: record._id }
        } catch (error) {
            if (sandbox) {
                let settledMicrousd = reservedMicrousd
                try {
                    if (sandboxSessionNeedsStop(sandbox.status)) await sandbox.stop()
                    const usage = await collectSandboxBillableUsage(sandbox)
                    settledMicrousd = calculateSandboxUsageMicrousd(usage)
                    await sandbox.delete()
                } catch (cleanupError) {
                    console.error("Failed to meter failed sandbox provisioning", cleanupError)
                    await sandbox.delete().catch(() => undefined)
                }
                await ctx.runMutation(internal.credits.commitReservedCreditForMessage, {
                    userId: user.id,
                    messageKey: billingMessageKey,
                    threadId: record.sourceThreadId,
                    messageId: record.sourceMessageId,
                    settledMicrousd,
                    pricingSource: "sandbox_reported"
                })
            } else {
                await ctx.runMutation(internal.credits.releaseReservedCreditForMessage, {
                    userId: user.id,
                    messageKey: billingMessageKey
                })
            }
            const message = getErrorMessage(error)
            await ctx.runMutation(
                internal.persistent_sandboxes.markPersistentSandboxProvisioningFailed,
                { sandboxId: record._id, error: message }
            )
            throw new ConvexError(message)
        }
    }
})

export const killMyPersistentSandbox = action({
    args: { sandboxId: v.id("persistentSandboxes") },
    handler: async (ctx, { sandboxId }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized")
        await assertAccountNotDeletingForAction(ctx, user.id)

        const record = await ctx.runMutation(
            internal.persistent_sandboxes.claimPersistentSandboxStop,
            { sandboxId, userId: user.id, reason: "user" }
        )
        if (!record) return { success: true }
        const result = await cleanupPersistentSandbox(ctx, record, "user")
        if (!result.success) throw new ConvexError(result.error)
        return result
    }
})

export const releasePersistentSandboxForUser = internalAction({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const active = await ctx.runQuery(
            internal.persistent_sandboxes.getActivePersistentSandboxForUser,
            { userId }
        )
        if (!active) return { success: true, released: false }
        const record = await ctx.runMutation(
            internal.persistent_sandboxes.claimPersistentSandboxStop,
            { sandboxId: active._id, userId, reason: "model" }
        )
        if (!record) {
            return {
                success: false,
                released: false,
                error: "The persistent sandbox still has an execution in progress. Release it after that execution finishes."
            }
        }
        const result = await cleanupPersistentSandbox(ctx, record, "model")
        if (!result.success) throw new Error(result.error)
        return { success: true, released: true }
    }
})

export const suspendIdlePersistentSandbox = internalAction({
    args: {
        sandboxId: v.id("persistentSandboxes"),
        activityLeaseId: v.string()
    },
    handler: async (ctx, args) => {
        const record = await ctx.runMutation(
            internal.persistent_sandboxes.claimPersistentSandboxIdleStop,
            args
        )
        if (!record || !record.sandboxName) return { success: true, suspended: false }

        const credentials = getVercelSandboxCredentials()
        if (!credentials) {
            await ctx.runMutation(internal.persistent_sandboxes.finalizePersistentSandboxIdleStop, {
                ...args,
                error: "Vercel Sandbox is not configured"
            })
            return { success: false, suspended: false }
        }

        try {
            const sandbox = await Sandbox.get({
                ...credentials,
                name: record.sandboxName,
                resume: false
            })
            await sandbox.stop()
            await ctx.runMutation(
                internal.persistent_sandboxes.finalizePersistentSandboxIdleStop,
                args
            )
            return { success: true, suspended: true }
        } catch (error) {
            if (isMissingSandboxError(error)) {
                await ctx.runMutation(
                    internal.persistent_sandboxes.finalizePersistentSandboxIdleStop,
                    args
                )
                return { success: true, suspended: true }
            }
            await ctx.runMutation(internal.persistent_sandboxes.finalizePersistentSandboxIdleStop, {
                ...args,
                error: getErrorMessage(error)
            })
            await ctx.scheduler.runAfter(
                CLEANUP_RETRY_DELAY_MS,
                internal.persistent_sandboxes_node.suspendIdlePersistentSandbox,
                args
            )
            return { success: false, suspended: false }
        }
    }
})

export const expirePersistentSandbox = internalAction({
    args: { sandboxId: v.id("persistentSandboxes") },
    handler: async (ctx, { sandboxId }) => {
        const current = await ctx.runQuery(
            internal.persistent_sandboxes.getPersistentSandboxInternal,
            { sandboxId }
        )
        const reason = current?.terminationReason ?? "expired"
        const record = await ctx.runMutation(
            internal.persistent_sandboxes.claimPersistentSandboxStop,
            { sandboxId, reason }
        )
        if (!record) return { success: true }
        return await cleanupPersistentSandbox(ctx, record, reason)
    }
})

export const reconcilePersistentSandboxes = internalAction({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const records = await ctx.runQuery(
            internal.persistent_sandboxes.listPersistentSandboxesNeedingCleanup,
            { now }
        )
        let cleaned = 0
        for (const current of records) {
            const reason = current.terminationReason ?? "expired"
            const record = await ctx.runMutation(
                internal.persistent_sandboxes.claimPersistentSandboxStop,
                { sandboxId: current._id, reason }
            )
            if (!record) continue
            const result = await cleanupPersistentSandbox(ctx, record, reason)
            if (result.success) cleaned += 1
        }
        return {
            recordsChecked: records.length,
            recordsCleaned: cleaned,
            hardLifetimeMs: MAX_PERSISTENT_SANDBOX_LIFETIME_MS
        }
    }
})

export const sweepOrphanedPersistentSandboxes = internalAction({
    args: {},
    handler: async () => ({
        provider: await sweepOverageProviderSandboxes(Date.now()),
        hardLifetimeMs: MAX_PERSISTENT_SANDBOX_LIFETIME_MS
    })
})
