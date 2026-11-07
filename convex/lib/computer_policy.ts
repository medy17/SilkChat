import type { ComputerKeyRoute } from "./computer_keys"

const DAY_MS = 24 * 60 * 60_000

export const COMPUTER_ARCHIVE_AFTER_MS = 14 * DAY_MS
export const COMPUTER_DELETE_AFTER_MS = 90 * DAY_MS
/** Days before deletion that each warning email goes out, in send order. */
export const COMPUTER_DELETION_WARNING_DAYS = [7, 1] as const
/**
 * Longer than any credit period, so an account out of credit always gets a fresh allowance in time
 * to ask Silky to clean up.
 */
export const COMPUTER_OVER_LIMIT_PURGE_AFTER_MS = 35 * DAY_MS
export const COMPUTER_OVER_LIMIT_WARNING_DAYS = [35, 7, 1] as const

export const COMPUTER_IDLE_SLEEP_MS = 90_000
export const COMPUTER_SESSION_TIMEOUT_MS = 30 * 60_000
export const COMPUTER_REQUEST_TTL_MS = 10 * 60_000
export const COMPUTER_STALE_OPERATION_MS = 10 * 60_000
export const COMPUTER_STALE_PROVISIONING_MS = 5 * 60_000

export const COMPUTER_COMMAND_DEFAULT_TIMEOUT_MS = 60_000
export const COMPUTER_COMMAND_MAX_TIMEOUT_MS = 240_000
export const MAX_COMPUTER_COMMAND_CHARS = 100_000
/**
 * A window this old is closed before the next command, so no command can outlive its session or
 * its credit reservation. It leaves room for the longest command to finish.
 */
export const COMPUTER_SESSION_ROLLOVER_MS =
    COMPUTER_SESSION_TIMEOUT_MS - COMPUTER_COMMAND_MAX_TIMEOUT_MS - 60_000

export const COMPUTER_WORKSPACE_PATH = "/vercel/workspace"
export const COMPUTER_ARTIFACT_ROOT = "/vercel/.silkchat/artifacts"
/** Vercel refuses a Drive size that is not a multiple of this. */
export const COMPUTER_DRIVE_BYTE_ALIGNMENT = 4096
/** The lowest plan limit. Vercel refuses a Drive smaller than this. */
export const COMPUTER_DRIVE_FLOOR_BYTES = 1024 ** 3
/**
 * Every Drive is created at this size, the true hard limit. A Drive's size can't change, and Vercel
 * bills only what's used, so plan limits are applied in code and can follow plan changes.
 */
export const COMPUTER_DRIVE_CEILING_BYTES =
    Math.floor(20_000_000_000 / COMPUTER_DRIVE_BYTE_ALIGNMENT) * COMPUTER_DRIVE_BYTE_ALIGNMENT
/** Leaves room for the base image, which is about 0.8 GB on its own. */
export const COMPUTER_SNAPSHOT_FLOOR_BYTES = 2_000_000_000
export const COMPUTER_SNAPSHOT_CEILING_BYTES = 10_000_000_000
export const COMPUTER_DEFAULT_NAME = "Silky's computer"
export const COMPUTER_MAX_NAME_LENGTH = 32

export type ComputerRetentionStep =
    | { action: "none" }
    | { action: "archive" }
    | { action: "warn"; daysLeft: number }
    | { action: "delete" }

/** Deletion waits for every warning, so a missed run delays it rather than surprising anyone. */
const getDeletionStep = ({
    warningDays,
    deleteAfterMs,
    elapsedMs,
    warningsSent
}: {
    warningDays: readonly number[]
    deleteAfterMs: number
    elapsedMs: number
    warningsSent: number
}): ComputerRetentionStep => {
    const nextWarningDays = warningDays[warningsSent]
    if (nextWarningDays !== undefined) {
        return elapsedMs >= deleteAfterMs - nextWarningDays * DAY_MS
            ? { action: "warn", daysLeft: nextWarningDays }
            : { action: "none" }
    }
    return elapsedMs >= deleteAfterMs ? { action: "delete" } : { action: "none" }
}

/** Where a dormant computer sits in its lifecycle. */
export const getComputerRetentionStep = ({
    status,
    lastUsedAt,
    warningsSent,
    now
}: {
    status: string
    lastUsedAt: number
    warningsSent: number
    now: number
}): ComputerRetentionStep => {
    const idleMs = now - lastUsedAt
    if (status === "ready") {
        return idleMs >= COMPUTER_ARCHIVE_AFTER_MS ? { action: "archive" } : { action: "none" }
    }
    if (status !== "archived") return { action: "none" }
    return getDeletionStep({
        warningDays: COMPUTER_DELETION_WARNING_DAYS,
        deleteAfterMs: COMPUTER_DELETE_AFTER_MS,
        elapsedMs: idleMs,
        warningsSent
    })
}

/** Where a computer over its plan's storage limit sits on the way to being purged. */
export const getComputerOverLimitStep = ({
    overLimitSince,
    warningsSent,
    now
}: {
    overLimitSince: number
    warningsSent: number
    now: number
}) =>
    getDeletionStep({
        warningDays: COMPUTER_OVER_LIMIT_WARNING_DAYS,
        deleteAfterMs: COMPUTER_OVER_LIMIT_PURGE_AFTER_MS,
        elapsedMs: now - overLimitSince,
        warningsSent
    })

export const describeComputerOverLimit = ({
    usedBytes,
    limitBytes,
    deletesAt
}: {
    usedBytes: number
    limitBytes: number
    deletesAt: number
}) => {
    const gb = (bytes: number) => (bytes / 1_000_000_000).toFixed(1)
    const date = new Date(deletesAt).toISOString().slice(0, 10)
    return `Your computer is over the user's storage limit, with ${gb(usedBytes)} GB used of ${gb(limitBytes)} GB. Its files will be deleted on ${date} unless it's back under by then. Tell the user, clear what can be rebuilt, and ask before deleting anything else. This clears the next time your computer sleeps with enough space freed.`
}

/** Keeps commands inside the workspace; the model only ever names a path within it. */
export const resolveComputerWorkingDirectory = (cwd: string | undefined) => {
    const requested = cwd?.trim() || "."
    const path = requested.startsWith("/") ? requested : `${COMPUTER_WORKSPACE_PATH}/${requested}`
    const segments: string[] = []
    for (const segment of path.split("/")) {
        if (segment === "..") segments.pop()
        else if (segment && segment !== ".") segments.push(segment)
    }
    const resolved = `/${segments.join("/")}`
    return resolved === COMPUTER_WORKSPACE_PATH ||
        resolved.startsWith(`${COMPUTER_WORKSPACE_PATH}/`)
        ? resolved
        : null
}

export const resolveComputerCommandTimeout = (timeoutMs: number | undefined) =>
    Math.min(
        COMPUTER_COMMAND_MAX_TIMEOUT_MS,
        Math.max(1_000, Math.round(timeoutMs ?? COMPUTER_COMMAND_DEFAULT_TIMEOUT_MS))
    )

/**
 * Keys never enter the VM. Vercel's egress proxy adds them to matching traffic, so code on the
 * computer can use a service but cannot read the credential. Other sites stay reachable.
 */
export const buildComputerNetworkPolicy = (routes: ComputerKeyRoute[]) => {
    if (routes.length === 0) return "allow-all" as const
    const allow: Record<
        string,
        Array<{ transform: Array<{ headers: Record<string, string> }> }>
    > = { "*": [] }
    for (const { host, headerName, headerValue } of routes) {
        allow[host] = [{ transform: [{ headers: { [headerName]: headerValue } }] }]
    }
    return { allow }
}

/** Whether a key changed after the sandbox last received its network policy. */
export const hasPendingComputerKeyChange = ({
    keysChangedAt,
    keysAppliedAt
}: {
    keysChangedAt?: number
    keysAppliedAt?: number
}) => keysChangedAt !== undefined && keysChangedAt >= (keysAppliedAt ?? 0)

export type ComputerViewState =
    | "setting_up"
    | "asleep"
    | "awake"
    | "working"
    | "stuck"
    | "busy"
    | "archived"

export const getComputerViewState = (computer: {
    status: string
    sessionState?: string
    executionInProgress?: boolean
    operation?: string
}): ComputerViewState => {
    if (computer.status === "provisioning") return "setting_up"
    if (computer.operation || computer.status === "deleting") return "busy"
    if (computer.status === "archived") return "archived"
    if (computer.sessionState === "stuck") return "stuck"
    if (computer.executionInProgress) return "working"
    return computer.sessionState === "running" ? "awake" : "asleep"
}
