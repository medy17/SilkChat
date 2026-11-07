"use node"

import { Drive, Sandbox } from "@vercel/sandbox"
import type { BetterAuthOptions } from "better-auth"
import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { type ActionCtx, action, internalAction } from "./_generated/server"
import { authComponent } from "./auth"
import { assertAccountNotDeletingForAction } from "./lib/account_deletion_gate"
import { getComputerKeyEnv, getComputerKeyRoutes } from "./lib/computer_keys"
import {
    COMPUTER_ARTIFACT_ROOT,
    COMPUTER_IDLE_SLEEP_MS,
    COMPUTER_SESSION_ROLLOVER_MS,
    COMPUTER_SESSION_TIMEOUT_MS,
    COMPUTER_WORKSPACE_PATH,
    MAX_COMPUTER_COMMAND_CHARS,
    buildComputerNetworkPolicy,
    describeComputerOverLimit,
    getComputerOverLimitStep,
    getComputerRetentionStep,
    hasPendingComputerKeyChange,
    resolveComputerCommandTimeout,
    resolveComputerWorkingDirectory
} from "./lib/computer_policy"
import { decryptKey } from "./lib/encryption"
import { getUserIdentity } from "./lib/identity"
import {
    calculateSandboxUsageMicrousd,
    collectSandboxSessionUsage,
    estimateComputerSessionReservationMicrousd,
    getComputerStorageLimits,
    sandboxSessionNeedsStop
} from "./lib/sandbox_billing"
import { isMissingSandboxError, isSandboxUnresponsiveError } from "./lib/sandbox_errors"
import { CODE_EXECUTION_ARTIFACT_DIRECTORY_ENV } from "./lib/tools/code_execution_artifacts"
import {
    collectCommandOutput,
    exportSandboxArtifacts,
    getVercelSandboxCredentials
} from "./lib/tools/code_execution_node"
import { getConfiguredHostedUsageLimits } from "./lib/usage_metering"

type ComputerRecord = Doc<"computers">

const SESSION_RESERVATION_MINUTES = COMPUTER_SESSION_TIMEOUT_MS / 60_000
const DRIVE_MEASURE_TIMEOUT_MS = 15_000

const getErrorMessage = (error: unknown, fallback = "Computer operation failed") =>
    error instanceof Error ? error.message : fallback

const requireCredentials = () => {
    const credentials = getVercelSandboxCredentials()
    if (!credentials) throw new Error("Vercel Sandbox is not configured")
    return credentials
}

const getComputerSandbox = async (record: ComputerRecord) => {
    try {
        return await Sandbox.get({
            ...requireCredentials(),
            name: record.sandboxName,
            resume: false
        })
    } catch (error) {
        if (isMissingSandboxError(error)) return null
        throw error
    }
}

const loadKeyRoutes = async (ctx: ActionCtx, userId: string) => {
    const keys: Doc<"computerKeys">[] = await ctx.runQuery(
        internal.computer_keys.listEnabledComputerKeys,
        { userId }
    )
    const routes = await Promise.all(
        keys.map(async (key) => getComputerKeyRoutes(key, await decryptKey(key.valueEncrypted)))
    )
    return routes.flat()
}

/** A Drive's size is fixed, and asking for an existing one at another size is an error. */
const getComputerDrive = (record: ComputerRecord) => {
    const params = { ...requireCredentials(), name: record.driveName }
    return record.driveMaxBytes === undefined
        ? Drive.get(params)
        : Drive.getOrCreate({ ...params, maxSize: record.driveMaxBytes })
}

const createComputerSandbox = async (ctx: ActionCtx, record: ComputerRecord) => {
    const credentials = requireCredentials()
    const drive = await getComputerDrive(record)
    const routes = await loadKeyRoutes(ctx, record.userId)
    return await Sandbox.create({
        ...credentials,
        name: record.sandboxName,
        resources: { vcpus: 1 },
        timeout: COMPUTER_SESSION_TIMEOUT_MS,
        persistent: true,
        // SilkChat owns the retention rules. A Vercel expiry would silently empty the computer.
        snapshotExpiration: 0,
        keepLastSnapshots: { count: 1, expiration: 0 },
        networkPolicy: buildComputerNetworkPolicy(routes),
        mounts: { [COMPUTER_WORKSPACE_PATH]: drive },
        tags: { app: "silkchat", feature: "computer", record: record._id }
    })
}

const openComputerBilling = async (ctx: ActionCtx, record: ComputerRecord) => {
    if (record.billingMessageKey) return
    const billingMessageKey = `computer:${record._id}:${crypto.randomUUID()}`
    const reservedMicrousd = estimateComputerSessionReservationMicrousd({
        sessionMinutes: SESSION_RESERVATION_MINUTES,
        vcpus: 1
    })
    const reservation = await ctx.runMutation(internal.credits.reserveCreditForMessage, {
        userId: record.userId,
        messageId: billingMessageKey,
        messageKey: billingMessageKey,
        providerSource: "internal",
        feature: "tool",
        counted: true,
        reservedMicrousd,
        pricingSource: "sandbox_estimate"
    })
    if (!reservation.allowed) {
        throw new Error(
            reservation.reason === "usage"
                ? "Using Silky's computer would exceed your current usage limit"
                : "Computer usage could not be reserved"
        )
    }
    await ctx.runMutation(internal.computers.setComputerBilling, {
        computerId: record._id,
        billingMessageKey,
        billingStartedAt: Date.now(),
        reservedMicrousd
    })
}

/** Settles the open billing window to measured use, or to the reservation if that's unknown. */
const settleComputerBilling = async (
    ctx: ActionCtx,
    record: ComputerRecord,
    sandbox: Sandbox | null
) => {
    if (!record.billingMessageKey) return
    if (!sandbox) {
        // Nothing exists to meter, which is how a failed setup ends. Don't charge for it.
        await ctx.runMutation(internal.credits.releaseReservedCreditForMessage, {
            userId: record.userId,
            messageKey: record.billingMessageKey
        })
        await ctx.runMutation(internal.computers.clearComputerBilling, { computerId: record._id })
        return
    }
    let settledMicrousd = record.reservedMicrousd
    try {
        settledMicrousd = calculateSandboxUsageMicrousd(
            await collectSandboxSessionUsage(sandbox, record.billingStartedAt ?? 0)
        )
    } catch (error) {
        console.error("Failed to meter computer session", error)
    }
    await ctx.runMutation(internal.credits.commitReservedCreditForMessage, {
        userId: record.userId,
        messageKey: record.billingMessageKey,
        messageId: record.billingMessageKey,
        settledMicrousd,
        pricingSource: "sandbox_reported"
    })
    await ctx.runMutation(internal.computers.clearComputerBilling, { computerId: record._id })
}

/** Reads the Drive's used size. Only call this on a running session, as a command wakes it. */
const measureComputerDrive = async (sandbox: Sandbox) => {
    try {
        const result = await sandbox.runCommand({
            cmd: "df",
            args: ["-B1", "--output=used", COMPUTER_WORKSPACE_PATH],
            timeoutMs: DRIVE_MEASURE_TIMEOUT_MS
        })
        const used = Number((await result.stdout()).trim().split("\n").pop())
        return Number.isFinite(used) ? used : undefined
    } catch (error) {
        console.error("Failed to measure computer storage", error)
        return undefined
    }
}

const stopComputerSession = async (ctx: ActionCtx, record: ComputerRecord) => {
    const sandbox = await getComputerSandbox(record)
    if (sandbox && sandboxSessionNeedsStop(sandbox.status)) {
        const driveUsedBytes =
            sandbox.status === "running" ? await measureComputerDrive(sandbox) : undefined
        const stopped = await sandbox.stop()
        await ctx.runMutation(internal.computers.recordComputerStorage, {
            computerId: record._id,
            driveUsedBytes,
            snapshotBytes: stopped.snapshot?.sizeBytes
        })
    }
    await settleComputerBilling(ctx, record, sandbox)
    return sandbox
}

const deleteComputerSandbox = async (sandbox: Sandbox | null) => {
    try {
        await sandbox?.delete({ deleteOrphanSnapshots: true })
    } catch (error) {
        if (!isMissingSandboxError(error)) throw error
    }
}

const purgeComputer = async (ctx: ActionCtx, userId: string) => {
    const record = await ctx.runMutation(internal.computers.claimComputerDeletion, { userId })
    if (!record) return
    await deleteComputerSandbox(await stopComputerSession(ctx, record))
    try {
        const drive = await Drive.get({ ...requireCredentials(), name: record.driveName })
        await drive.delete()
    } catch (error) {
        if (!isMissingSandboxError(error)) throw error
    }
    await ctx.runMutation(internal.computers.removeComputerRecord, { computerId: record._id })
}

const scheduleIdleSleep = (ctx: ActionCtx, record: ComputerRecord, activityLeaseId: string) =>
    ctx.scheduler.runAfter(COMPUTER_IDLE_SLEEP_MS, internal.computers_node.suspendIdleComputer, {
        computerId: record._id,
        activityLeaseId
    })

const UNAVAILABLE_MESSAGES = {
    missing: "Your computer isn't set up yet. Call request_computer once to set it up.",
    busy: "Your computer is busy with another command. Retry shortly.",
    unavailable: "Your computer isn't available right now. Retry shortly."
}
const KEY_CHANGE_FAILED_MESSAGE =
    "The user's keys changed and your computer couldn't pick that up, so nothing ran. Retry shortly."
const SETUP_ABANDONED_MESSAGE = "Setup didn't finish. Ask Silky to try again."
const LOST_COMMAND_MESSAGE =
    "Lost contact with your computer while that command ran, so it may or may not have finished. Check what it did before running it again."

/** Sends the sandbox any key change it hasn't received. A sleeping sandbox gets it on waking. */
const applyPendingKeyChange = async (ctx: ActionCtx, record: ComputerRecord, sandbox: Sandbox) => {
    if (!hasPendingComputerKeyChange(record)) return
    const appliedAt = Date.now()
    await sandbox.update({
        networkPolicy: buildComputerNetworkPolicy(await loadKeyRoutes(ctx, record.userId))
    })
    await ctx.runMutation(internal.computers.markComputerKeysApplied, {
        computerId: record._id,
        appliedAt
    })
}

const isBillingWindowDue = ({ billingStartedAt }: ComputerRecord) =>
    billingStartedAt !== undefined && Date.now() - billingStartedAt >= COMPUTER_SESSION_ROLLOVER_MS

/**
 * Runs work on the computer: claims the single execution slot, opens billing, wakes or rebuilds
 * the sandbox, and hands back to the idle timer.
 *
 * Only `prepare` is retried after an unresponsive VM. `run` acts on the user's real accounts, so
 * it runs at most once, even if the VM stops answering part way through.
 */
const withComputerSession = async <T>(
    ctx: ActionCtx,
    userId: string,
    prepare: (sandbox: Sandbox) => Promise<void>,
    run: (sandbox: Sandbox) => Promise<T>
): Promise<T> => {
    const activityLeaseId = crypto.randomUUID()
    const begun = await ctx.runMutation(internal.computers.beginComputerExecution, {
        userId,
        activityLeaseId
    })
    if (!begun.ok) throw new Error(UNAVAILABLE_MESSAGES[begun.reason])

    let record = begun.record
    let stuck = false
    try {
        if (record.scheduledIdleStopId) {
            await ctx.scheduler.cancel(record.scheduledIdleStopId).catch(() => undefined)
        }
        // Closing the window here re-checks credit, and gives the next command a full session.
        if (isBillingWindowDue(record)) {
            await stopComputerSession(ctx, record)
            record = { ...record, billingMessageKey: undefined }
        }
        await openComputerBilling(ctx, record)

        const existing = record.status === "archived" ? null : await getComputerSandbox(record)
        let sandbox = existing ?? (await createComputerSandbox(ctx, record))
        if (!existing) {
            await ctx.runMutation(internal.computers.markComputerReady, {
                computerId: record._id,
                activityLeaseId
            })
        }

        try {
            await prepare(sandbox)
        } catch (error) {
            if (!isSandboxUnresponsiveError(error)) throw error
            await sandbox.stop()
            const restarted = await getComputerSandbox(record)
            if (!restarted) throw error
            sandbox = restarted
            try {
                await prepare(sandbox)
            } catch (retryError) {
                stuck = isSandboxUnresponsiveError(retryError)
                throw retryError
            }
        }

        // Stop here rather than run a command with a key the user may have just turned off.
        await applyPendingKeyChange(ctx, record, sandbox).catch((error) => {
            console.error("Failed to apply computer key change", error)
            throw new Error(KEY_CHANGE_FAILED_MESSAGE)
        })
        return await run(sandbox)
    } finally {
        const scheduledIdleStopId = stuck
            ? undefined
            : await scheduleIdleSleep(ctx, record, activityLeaseId)
        await ctx.runMutation(internal.computers.finishComputerExecution, {
            computerId: record._id,
            activityLeaseId,
            scheduledIdleStopId,
            stuck
        })
    }
}

export const confirmComputerRequest = action({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        toolCallId: v.string(),
        cardId: v.string()
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized")
        await assertAccountNotDeletingForAction(ctx, user.id)
        if (!getVercelSandboxCredentials()) {
            throw new ConvexError("Vercel Sandbox is not configured")
        }

        const id = crypto.randomUUID()
        const claimed = await ctx.runMutation(internal.computers.claimComputerRequest, {
            ...args,
            userId: user.id,
            authUserId: user.authId,
            sandboxName: `silkchat-computer-${id}`,
            driveName: `silkchat-computer-${id}`
        })
        if (!claimed.ok) throw new ConvexError(claimed.error)

        const record = claimed.record
        try {
            await openComputerBilling(ctx, record)
            await createComputerSandbox(ctx, record)
            const activityLeaseId = crypto.randomUUID()
            await ctx.runMutation(internal.computers.markComputerReady, {
                computerId: record._id,
                activityLeaseId,
                scheduledIdleStopId: await scheduleIdleSleep(ctx, record, activityLeaseId)
            })
            await ctx.runMutation(internal.computers.finishComputerRequest, {
                ...args,
                status: "ready"
            })
        } catch (error) {
            const message = getErrorMessage(error)
            await purgeComputer(ctx, user.id).catch((cleanupError) =>
                console.error("Failed to clean up computer setup", cleanupError)
            )
            await ctx.runMutation(internal.computers.finishComputerRequest, {
                ...args,
                status: "failed",
                error: message
            })
            throw new ConvexError(message)
        }
    }
})

export const executeOnComputer = internalAction({
    args: {
        userId: v.string(),
        command: v.string(),
        cwd: v.optional(v.string()),
        timeoutMs: v.optional(v.number())
    },
    handler: async (ctx, { userId, command, cwd, timeoutMs }): Promise<Record<string, unknown>> => {
        const workingDirectory = resolveComputerWorkingDirectory(cwd)
        if (!workingDirectory) {
            return {
                success: false,
                phase: "computer",
                error: `cwd must be inside ${COMPUTER_WORKSPACE_PATH}`
            }
        }
        if (!command.trim() || command.length > MAX_COMPUTER_COMMAND_CHARS) {
            return { success: false, phase: "computer", error: "Command is empty or too long" }
        }

        const artifactDirectory = `${COMPUTER_ARTIFACT_ROOT}/${crypto.randomUUID()}`
        try {
            const [keys, overLimit]: [
                Doc<"computerKeys">[],
                { usedBytes: number; limitBytes: number; deletesAt: number } | null
            ] = await Promise.all([
                ctx.runQuery(internal.computer_keys.listEnabledComputerKeys, { userId }),
                ctx.runQuery(internal.computers.getComputerOverLimitNotice, { userId })
            ])
            return await withComputerSession(
                ctx,
                userId,
                async (sandbox) => {
                    await sandbox.fs.mkdir(artifactDirectory, { recursive: true })
                },
                async (sandbox) => {
                    try {
                        const result = await sandbox.runCommand({
                            cmd: "bash",
                            args: ["-lc", command],
                            cwd: workingDirectory,
                            env: {
                                [CODE_EXECUTION_ARTIFACT_DIRECTORY_ENV]: artifactDirectory,
                                ...getComputerKeyEnv(keys)
                            },
                            timeoutMs: resolveComputerCommandTimeout(timeoutMs)
                        })
                        return {
                            success: result.exitCode === 0,
                            phase: "execution",
                            exitCode: result.exitCode,
                            durationMs: result.durationMs,
                            cwd: workingDirectory,
                            // The command has finished, so failing to read its output can't be
                            // allowed to look like a failed command.
                            ...(await collectCommandOutput(result).catch(() => ({
                                stdout: "",
                                stderr: "",
                                outputTruncated: false,
                                outputUnavailable: true
                            }))),
                            ...(await exportSandboxArtifacts({
                                sandbox,
                                artifactDirectory,
                                userId,
                                ctx
                            }).catch((error) => ({
                                artifacts: [],
                                artifactErrors: [
                                    { filename: "artifacts", error: getErrorMessage(error) }
                                ]
                            }))),
                            ...(overLimit
                                ? { storageWarning: describeComputerOverLimit(overLimit) }
                                : {})
                        }
                    } catch (error) {
                        if (!isSandboxUnresponsiveError(error)) throw error
                        return { success: false, phase: "computer", error: LOST_COMMAND_MESSAGE }
                    } finally {
                        await sandbox.fs
                            .rm(artifactDirectory, { recursive: true, force: true })
                            .catch(() => undefined)
                    }
                }
            )
        } catch (error) {
            return { success: false, phase: "computer", error: getErrorMessage(error) }
        }
    }
})

const runOperation = async (
    ctx: ActionCtx,
    operation: "sleep" | "restart" | "reset",
    work: (record: ComputerRecord) => Promise<void>
) => {
    const user = await getUserIdentity(ctx.auth, { allowAnons: false })
    if ("error" in user) throw new ConvexError("Unauthorized")
    await assertAccountNotDeletingForAction(ctx, user.id)
    const record = await ctx.runMutation(internal.computers.claimComputerOperation, {
        userId: user.id,
        operation
    })
    if (!record) throw new ConvexError("The computer can't do that right now")
    try {
        await work(record)
        await ctx.runMutation(internal.computers.markComputerStopped, { computerId: record._id })
    } catch (error) {
        await ctx.runMutation(internal.computers.releaseComputerOperation, {
            computerId: record._id
        })
        throw new ConvexError(getErrorMessage(error))
    }
}

export const sleepMyComputer = action({
    args: {},
    handler: async (ctx) => {
        await runOperation(ctx, "sleep", async (record) => {
            await stopComputerSession(ctx, record)
        })
    }
})

/** Stopping clears a stuck session. The next command boots fresh from the last snapshot. */
export const restartMyComputer = action({
    args: {},
    handler: async (ctx) => {
        await runOperation(ctx, "restart", async (record) => {
            await stopComputerSession(ctx, record)
        })
    }
})

/** Drops the computer but keeps the Drive. The next command rebuilds on the latest image. */
export const resetMyComputer = action({
    args: {},
    handler: async (ctx) => {
        await runOperation(ctx, "reset", async (record) => {
            await deleteComputerSandbox(await stopComputerSession(ctx, record))
            await ctx.runMutation(internal.computers.recordComputerStorage, {
                computerId: record._id,
                snapshotBytes: 0
            })
        })
    }
})

export const deleteMyComputer = action({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ConvexError("Unauthorized")
        try {
            await purgeComputer(ctx, user.id)
        } catch (error) {
            throw new ConvexError(getErrorMessage(error))
        }
    }
})

export const deleteComputerForUser = internalAction({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        await purgeComputer(ctx, userId)
        await ctx.runMutation(internal.computer_keys.deleteComputerKeysForUser, { userId })
    }
})

/**
 * The Drive's size limit doesn't reach anything written outside the workspace, which lands in the
 * snapshot at a higher rate. Past the plan's limit, rebuild on the next command. Project files stay.
 */
const dropOversizedSnapshot = async (
    ctx: ActionCtx,
    record: ComputerRecord,
    sandbox: Sandbox | null
) => {
    const current = await ctx.runQuery(internal.computers.getComputerForUser, {
        userId: record.userId
    })
    const plan = await ctx.runQuery(internal.credits.getUserCreditPlanInternal, {
        userId: record.userId
    })
    const { snapshotMaxBytes } = getComputerStorageLimits(
        getConfiguredHostedUsageLimits(plan).monthlyMicrousd
    )
    if ((current?.snapshotBytes ?? 0) <= snapshotMaxBytes) return
    await deleteComputerSandbox(sandbox)
    await ctx.runMutation(internal.computers.recordComputerStorage, {
        computerId: record._id,
        snapshotBytes: 0
    })
}

export const suspendIdleComputer = internalAction({
    args: { computerId: v.id("computers"), activityLeaseId: v.string() },
    handler: async (ctx, args) => {
        const record = await ctx.runMutation(internal.computers.claimComputerIdleStop, args)
        if (!record) return
        try {
            await dropOversizedSnapshot(ctx, record, await stopComputerSession(ctx, record))
        } catch (error) {
            console.error("Failed to put computer to sleep", error)
        }
        await ctx.runMutation(internal.computers.markComputerStopped, { computerId: record._id })
    }
})

export const applyComputerNetworkPolicy = internalAction({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const record = await ctx.runQuery(internal.computers.getComputerForUser, { userId })
        if (!record) return
        const sandbox = await getComputerSandbox(record)
        if (sandbox) await applyPendingKeyChange(ctx, record, sandbox)
    }
})

const sendDeletionNotice = async (
    ctx: ActionCtx,
    record: ComputerRecord,
    daysLeft: number,
    reason: "dormant" | "storage"
) => {
    const adapter = authComponent.adapter(ctx)({} as BetterAuthOptions)
    const user = (await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: record.authUserId }]
    })) as { email?: unknown; emailVerified?: unknown; name?: unknown } | null
    if (typeof user?.email !== "string" || user.emailVerified !== true) return

    const { sendComputerDeletionNoticeEmail } = await import("../src/lib/email")
    await sendComputerDeletionNoticeEmail({
        email: user.email,
        name: typeof user.name === "string" ? user.name : undefined,
        daysLeft,
        reason,
        idempotencyKey:
            reason === "storage"
                ? `computer-over-limit/${record._id}/${record.overLimitSince}/${daysLeft}`
                : `computer-deletion/${record._id}/${record.lastUsedAt}/${daysLeft}`
    })
}

const purgeOverLimitComputers = async (ctx: ActionCtx, now: number) => {
    const records: ComputerRecord[] = await ctx.runQuery(
        internal.computers.listComputersOverLimit,
        {}
    )
    for (const record of records) {
        const step = getComputerOverLimitStep({
            overLimitSince: record.overLimitSince as number,
            warningsSent: record.overLimitWarningsSent ?? 0,
            now
        })
        try {
            if (step.action === "warn") {
                await sendDeletionNotice(ctx, record, step.daysLeft, "storage")
                await ctx.runMutation(internal.computers.recordComputerOverLimitWarning, {
                    computerId: record._id
                })
            } else if (step.action === "delete") {
                // An awake computer may be cleaning up right now, and its reading is out of date.
                if (record.executionInProgress || record.sessionState === "running") continue
                await purgeComputer(ctx, record.userId)
            }
        } catch (error) {
            console.error("Computer over-limit step failed", {
                computerId: record._id,
                step: step.action,
                error
            })
        }
    }
}

export const runComputerRetention = internalAction({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const records = await ctx.runQuery(internal.computers.listComputersForRetention, { now })
        for (const record of records) {
            const step = getComputerRetentionStep({
                status: record.status,
                lastUsedAt: record.lastUsedAt,
                warningsSent: record.deletionWarningsSent ?? 0,
                now
            })
            try {
                if (step.action === "archive") {
                    const claimed = await ctx.runMutation(internal.computers.claimComputerArchive, {
                        computerId: record._id
                    })
                    if (!claimed) continue
                    await deleteComputerSandbox(await stopComputerSession(ctx, claimed))
                    await ctx.runMutation(internal.computers.markComputerArchived, {
                        computerId: record._id
                    })
                } else if (step.action === "warn") {
                    await sendDeletionNotice(ctx, record, step.daysLeft, "dormant")
                    await ctx.runMutation(internal.computers.recordComputerDeletionWarning, {
                        computerId: record._id
                    })
                } else if (step.action === "delete") {
                    await purgeComputer(ctx, record.userId)
                }
            } catch (error) {
                console.error("Computer retention step failed", {
                    computerId: record._id,
                    step: step.action,
                    error
                })
            }
        }
        await purgeOverLimitComputers(ctx, now)
    }
})

export const reconcileComputers = internalAction({
    args: {},
    handler: async (ctx) => {
        const { stale, abandoned } = await ctx.runQuery(
            internal.computers.listComputersNeedingReconcile,
            { now: Date.now() }
        )
        for (const record of stale) {
            try {
                await stopComputerSession(ctx, record)
                await ctx.runMutation(internal.computers.markComputerStopped, {
                    computerId: record._id
                })
            } catch (error) {
                console.error("Failed to reconcile computer", { computerId: record._id, error })
            }
        }
        for (const record of abandoned) {
            await purgeComputer(ctx, record.userId).catch((error) =>
                console.error("Failed to clean up abandoned computer", {
                    computerId: record._id,
                    error
                })
            )
            if (record.setupCard) {
                await ctx.runMutation(internal.computers.finishComputerRequest, {
                    ...record.setupCard,
                    status: "failed",
                    error: SETUP_ABANDONED_MESSAGE
                })
            }
        }
    }
})
