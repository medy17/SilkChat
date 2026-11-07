import {
    COMPUTER_DRIVE_CEILING_BYTES,
    COMPUTER_DRIVE_FLOOR_BYTES,
    COMPUTER_SNAPSHOT_CEILING_BYTES,
    COMPUTER_SNAPSHOT_FLOOR_BYTES
} from "./computer_policy"
import { microusdToUsd, usdToMicrousd } from "./usage_metering"

const HOUR_MS = 60 * 60_000
const BILLING_MONTH_MS = 30 * 24 * HOUR_MS
const BYTES_PER_GB = 1_000_000_000
const MB_PER_GB = 1024
const DRIVE_BYTE_ALIGNMENT = 4096
// A full computer stays well inside a plan's allowance, leaving the rest for time awake and chat.
const DRIVE_ALLOWANCE_SHARE = 0.5
const SNAPSHOT_ALLOWANCE_SHARE = 0.25
// Sessions spend most of their time waiting on the model, so a reservation that assumed a busy CPU
// would refuse the computer outright on a small free allowance. Settling uses the measured figure.
const COMPUTER_RESERVATION_CPU_SHARE = 0.25

// Vercel Sandbox Pro rates, last verified against the official pricing page on 2026-07-18.
// Environment overrides let us update billing immediately if provider rates change.
const DEFAULT_RATES = {
    activeCpuUsdPerHour: 0.128,
    provisionedMemoryUsdPerGbHour: 0.0212,
    creationUsd: 0.6 / 1_000_000,
    dataTransferUsdPerGb: 0.15,
    snapshotStorageUsdPerGbMonth: 0.08,
    driveStorageUsdPerGbMonth: 0.05
} as const

const configuredRate = (name: string, fallback: number) => {
    const value = process.env[name]
    if (!value?.trim()) return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export type SandboxBillableUsage = {
    activeCpuDurationMs: number
    provisionedMemoryGbMs: number
    ingressBytes: number
    egressBytes: number
    snapshotByteMs: number
    creations: number
    sessionCount: number
}

export const sandboxSessionNeedsStop = (status: string) =>
    status !== "stopped" && status !== "failed" && status !== "aborted"

export const getSandboxBillingRates = () => ({
    activeCpuUsdPerHour: configuredRate(
        "VERCEL_SANDBOX_ACTIVE_CPU_USD_PER_HOUR",
        DEFAULT_RATES.activeCpuUsdPerHour
    ),
    provisionedMemoryUsdPerGbHour: configuredRate(
        "VERCEL_SANDBOX_MEMORY_USD_PER_GB_HOUR",
        DEFAULT_RATES.provisionedMemoryUsdPerGbHour
    ),
    creationUsd: configuredRate("VERCEL_SANDBOX_CREATION_USD", DEFAULT_RATES.creationUsd),
    dataTransferUsdPerGb: configuredRate(
        "VERCEL_SANDBOX_TRANSFER_USD_PER_GB",
        DEFAULT_RATES.dataTransferUsdPerGb
    ),
    snapshotStorageUsdPerGbMonth: configuredRate(
        "VERCEL_SANDBOX_SNAPSHOT_USD_PER_GB_MONTH",
        DEFAULT_RATES.snapshotStorageUsdPerGbMonth
    ),
    driveStorageUsdPerGbMonth: configuredRate(
        "VERCEL_SANDBOX_DRIVE_USD_PER_GB_MONTH",
        DEFAULT_RATES.driveStorageUsdPerGbMonth
    )
})

const bytesWithinBudget = (usd: number, usdPerGbMonth: number, floor: number, ceiling: number) => {
    const bytes = usdPerGbMonth > 0 ? (usd / usdPerGbMonth) * BYTES_PER_GB : ceiling
    const clamped = Math.min(ceiling, Math.max(floor, bytes))
    return Math.floor(clamped / DRIVE_BYTE_ALIGNMENT) * DRIVE_BYTE_ALIGNMENT
}

/** How much a computer may store on a plan, scaled to its monthly allowance. */
export const getComputerStorageLimits = (monthlyLimitMicrousd: number) => {
    const rates = getSandboxBillingRates()
    const monthlyUsd = microusdToUsd(monthlyLimitMicrousd)
    return {
        driveLimitBytes: bytesWithinBudget(
            monthlyUsd * DRIVE_ALLOWANCE_SHARE,
            rates.driveStorageUsdPerGbMonth,
            COMPUTER_DRIVE_FLOOR_BYTES,
            COMPUTER_DRIVE_CEILING_BYTES
        ),
        snapshotMaxBytes: bytesWithinBudget(
            monthlyUsd * SNAPSHOT_ALLOWANCE_SHARE,
            rates.snapshotStorageUsdPerGbMonth,
            COMPUTER_SNAPSHOT_FLOOR_BYTES,
            COMPUTER_SNAPSHOT_CEILING_BYTES
        )
    }
}

export const estimateComputerStorageMonthlyMicrousd = ({
    driveBytes,
    snapshotBytes
}: {
    driveBytes: number
    snapshotBytes: number
}) => {
    const rates = getSandboxBillingRates()
    return usdToMicrousd(
        (Math.max(0, driveBytes) / BYTES_PER_GB) * rates.driveStorageUsdPerGbMonth +
            (Math.max(0, snapshotBytes) / BYTES_PER_GB) * rates.snapshotStorageUsdPerGbMonth
    )
}

/** The share of a month's storage cost that built up over a stretch of time. */
export const accrueComputerStorageMicrousd = (monthlyMicrousd: number, elapsedMs: number) =>
    Math.round((Math.max(0, monthlyMicrousd) * Math.max(0, elapsedMs)) / BILLING_MONTH_MS)

export const estimateComputerSessionReservationMicrousd = ({
    sessionMinutes,
    vcpus = 1
}: {
    sessionMinutes: number
    vcpus?: number
}) => {
    const durationMs = Math.max(0, sessionMinutes) * 60_000
    const memoryGb = Math.max(0, vcpus) * 2
    return calculateSandboxUsageMicrousd({
        activeCpuDurationMs: durationMs * Math.max(0, vcpus) * COMPUTER_RESERVATION_CPU_SHARE,
        provisionedMemoryGbMs: durationMs * memoryGb,
        ingressBytes: 0,
        egressBytes: 0,
        snapshotByteMs: 0,
        creations: 1,
        sessionCount: 1
    })
}

export const calculateSandboxUsageMicrousd = (usage: SandboxBillableUsage) => {
    const rates = getSandboxBillingRates()
    const transferBytes = Math.max(0, usage.ingressBytes) + Math.max(0, usage.egressBytes)
    const usd =
        (Math.max(0, usage.activeCpuDurationMs) / HOUR_MS) * rates.activeCpuUsdPerHour +
        (Math.max(0, usage.provisionedMemoryGbMs) / HOUR_MS) * rates.provisionedMemoryUsdPerGbHour +
        Math.max(0, usage.creations) * rates.creationUsd +
        (transferBytes / BYTES_PER_GB) * rates.dataTransferUsdPerGb +
        (Math.max(0, usage.snapshotByteMs) / BYTES_PER_GB / BILLING_MONTH_MS) *
            rates.snapshotStorageUsdPerGbMonth

    return usdToMicrousd(usd)
}

// Session timestamps come from Vercel and the cursor from Convex, so allow for clock drift.
const SESSION_CURSOR_SLACK_MS = 2_000

/** Compute used since a billing window opened. Storage and creation are not per-session costs. */
export const collectSandboxSessionUsage = async (
    sandbox: {
        listSessions: (params: { sortOrder: "desc" }) => Promise<
            AsyncIterable<{
                memory: number
                requestedAt: number
                duration?: number
                activeCpuDurationMs?: number
                networkTransfer?: { ingress: number; egress: number }
            }>
        >
    },
    sinceMs: number
): Promise<SandboxBillableUsage> => {
    const usage: SandboxBillableUsage = {
        activeCpuDurationMs: 0,
        provisionedMemoryGbMs: 0,
        ingressBytes: 0,
        egressBytes: 0,
        snapshotByteMs: 0,
        creations: 0,
        sessionCount: 0
    }
    // Newest first, so this stops at the window instead of walking the computer's whole history.
    for await (const session of await sandbox.listSessions({ sortOrder: "desc" })) {
        if (session.requestedAt < sinceMs - SESSION_CURSOR_SLACK_MS) break
        usage.sessionCount += 1
        usage.activeCpuDurationMs += Math.max(0, session.activeCpuDurationMs ?? 0)
        usage.provisionedMemoryGbMs +=
            (Math.max(0, session.memory) / MB_PER_GB) * Math.max(60_000, session.duration ?? 0)
        usage.ingressBytes += Math.max(0, session.networkTransfer?.ingress ?? 0)
        usage.egressBytes += Math.max(0, session.networkTransfer?.egress ?? 0)
    }
    return usage
}

export const collectSandboxBillableUsage = async (
    sandbox: {
        listSessions: () => Promise<
            AsyncIterable<{
                memory: number
                duration?: number
                activeCpuDurationMs?: number
                networkTransfer?: { ingress: number; egress: number }
            }>
        >
        listSnapshots: () => Promise<AsyncIterable<{ sizeBytes: number; createdAt: Date | number }>>
    },
    now = Date.now()
): Promise<SandboxBillableUsage> => {
    let activeCpuDurationMs = 0
    let provisionedMemoryGbMs = 0
    let ingressBytes = 0
    let egressBytes = 0
    let sessionCount = 0

    const sessions = await sandbox.listSessions()
    for await (const session of sessions) {
        sessionCount += 1
        const billedDurationMs = Math.max(60_000, session.duration ?? 0)
        activeCpuDurationMs += Math.max(0, session.activeCpuDurationMs ?? 0)
        provisionedMemoryGbMs += (Math.max(0, session.memory) / MB_PER_GB) * billedDurationMs
        ingressBytes += Math.max(0, session.networkTransfer?.ingress ?? 0)
        egressBytes += Math.max(0, session.networkTransfer?.egress ?? 0)
    }

    let snapshotByteMs = 0
    const snapshots = await sandbox.listSnapshots()
    for await (const snapshot of snapshots) {
        const createdAt =
            snapshot.createdAt instanceof Date ? snapshot.createdAt.getTime() : snapshot.createdAt
        snapshotByteMs += Math.max(0, snapshot.sizeBytes) * Math.max(0, now - createdAt)
    }

    return {
        activeCpuDurationMs,
        provisionedMemoryGbMs,
        ingressBytes,
        egressBytes,
        snapshotByteMs,
        creations: 1,
        sessionCount
    }
}
