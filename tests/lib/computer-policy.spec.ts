import { describe, expect, it } from "vitest"
import {
    buildComputerNetworkPolicy,
    getComputerOverLimitStep,
    getComputerRetentionStep,
    getComputerViewState,
    resolveComputerCommandTimeout,
    resolveComputerWorkingDirectory
} from "../../convex/lib/computer_policy"
import { collectSandboxSessionUsage } from "../../convex/lib/sandbox_billing"
import { isSandboxUnresponsiveError } from "../../convex/lib/sandbox_errors"
import { getMessageComputerRuns } from "../../src/lib/message-computer-runs"

const DAY_MS = 24 * 60 * 60_000
const NOW = 1_800_000_000_000

const stepAfterDays = (days: number, status: string, warningsSent = 0) =>
    getComputerRetentionStep({
        status,
        lastUsedAt: NOW - days * DAY_MS,
        warningsSent,
        now: NOW
    })

describe("computer retention", () => {
    it("archives a ready computer only after 14 unused days", () => {
        expect(stepAfterDays(13, "ready")).toEqual({ action: "none" })
        expect(stepAfterDays(14, "ready")).toEqual({ action: "archive" })
    })

    it("warns 7 days and 1 day before deletion, in order", () => {
        expect(stepAfterDays(82, "archived")).toEqual({ action: "none" })
        expect(stepAfterDays(83, "archived")).toEqual({ action: "warn", daysLeft: 7 })
        expect(stepAfterDays(88, "archived", 1)).toEqual({ action: "none" })
        expect(stepAfterDays(89, "archived", 1)).toEqual({ action: "warn", daysLeft: 1 })
    })

    it("deletes at 90 days, but never before both warnings have gone out", () => {
        expect(stepAfterDays(89, "archived", 2)).toEqual({ action: "none" })
        expect(stepAfterDays(90, "archived", 2)).toEqual({ action: "delete" })
        expect(stepAfterDays(120, "archived", 0)).toEqual({ action: "warn", daysLeft: 7 })
        expect(stepAfterDays(120, "archived", 1)).toEqual({ action: "warn", daysLeft: 1 })
    })

    it("leaves computers mid-transition alone", () => {
        expect(stepAfterDays(200, "provisioning")).toEqual({ action: "none" })
        expect(stepAfterDays(200, "deleting")).toEqual({ action: "none" })
    })
})

describe("computer working directory", () => {
    it("resolves paths inside the workspace", () => {
        expect(resolveComputerWorkingDirectory(undefined)).toBe("/vercel/workspace")
        expect(resolveComputerWorkingDirectory("repo/src")).toBe("/vercel/workspace/repo/src")
        expect(resolveComputerWorkingDirectory("/vercel/workspace/repo")).toBe(
            "/vercel/workspace/repo"
        )
    })

    it("rejects paths that escape it", () => {
        expect(resolveComputerWorkingDirectory("../..")).toBeNull()
        expect(resolveComputerWorkingDirectory("repo/../../other")).toBeNull()
        expect(resolveComputerWorkingDirectory("/etc")).toBeNull()
        expect(resolveComputerWorkingDirectory("/vercel/workspace-evil")).toBeNull()
    })
})

describe("computer commands and network", () => {
    it("bounds command timeouts", () => {
        expect(resolveComputerCommandTimeout(undefined)).toBe(60_000)
        expect(resolveComputerCommandTimeout(10)).toBe(1_000)
        expect(resolveComputerCommandTimeout(9_999_999)).toBe(240_000)
    })

    it("keeps open network access and adds credentials only to matching hosts", () => {
        expect(buildComputerNetworkPolicy([])).toBe("allow-all")

        const policy = buildComputerNetworkPolicy([
            { host: "api.example.com", headerName: "x-api-key", headerValue: "secret" }
        ])
        if (policy === "allow-all") throw new Error("expected a custom policy")
        expect(policy.allow["*"]).toEqual([])
        expect(policy.allow["api.example.com"]).toEqual([
            { transform: [{ headers: { "x-api-key": "secret" } }] }
        ])
    })
})

describe("computer view state", () => {
    it("reports a stuck session over an interrupted execution", () => {
        expect(
            getComputerViewState({
                status: "ready",
                sessionState: "stuck",
                executionInProgress: true
            })
        ).toBe("stuck")
    })

    it("reads a stopped or never-started session as asleep", () => {
        expect(getComputerViewState({ status: "ready", sessionState: "stopped" })).toBe("asleep")
        expect(getComputerViewState({ status: "ready" })).toBe("asleep")
    })

    it("shows a running operation before anything else", () => {
        expect(
            getComputerViewState({ status: "ready", sessionState: "stuck", operation: "restart" })
        ).toBe("busy")
    })
})

describe("computers over their storage limit", () => {
    const stepAfter = (days: number, warningsSent: number) =>
        getComputerOverLimitStep({
            overLimitSince: NOW - days * DAY_MS,
            warningsSent,
            now: NOW
        })

    it("warns as soon as it goes over, then a week and a day before the purge", () => {
        expect(stepAfter(0, 0)).toEqual({ action: "warn", daysLeft: 35 })
        expect(stepAfter(20, 1)).toEqual({ action: "none" })
        expect(stepAfter(28, 1)).toEqual({ action: "warn", daysLeft: 7 })
        expect(stepAfter(34, 2)).toEqual({ action: "warn", daysLeft: 1 })
    })

    it("purges only after the deadline", () => {
        expect(stepAfter(34, 3)).toEqual({ action: "none" })
        expect(stepAfter(35, 3)).toEqual({ action: "delete" })
    })

    it("never purges before every warning has gone out", () => {
        expect(stepAfter(60, 1)).toEqual({ action: "warn", daysLeft: 7 })
    })
})

describe("computer session billing", () => {
    const sandboxWith = (
        sessions: Array<{ requestedAt: number; duration: number; activeCpuDurationMs: number }>
    ) => ({
        listSessions: async () =>
            (async function* () {
                for (const session of sessions) yield { ...session, memory: 2048 }
            })()
    })

    it("only counts sessions from the open billing window", async () => {
        const usage = await collectSandboxSessionUsage(
            sandboxWith([
                { requestedAt: 100_000, duration: 120_000, activeCpuDurationMs: 4_000 },
                { requestedAt: 1_000, duration: 300_000, activeCpuDurationMs: 9_000 }
            ]),
            100_000
        )
        expect(usage.sessionCount).toBe(1)
        expect(usage.activeCpuDurationMs).toBe(4_000)
        expect(usage.provisionedMemoryGbMs).toBe(240_000)
    })

    it("stops reading history once it passes the billing window", async () => {
        const read: number[] = []
        await collectSandboxSessionUsage(
            {
                listSessions: async () =>
                    (async function* () {
                        for (const requestedAt of [200_000, 1_000, 500]) {
                            read.push(requestedAt)
                            yield { requestedAt, memory: 2048, duration: 1_000 }
                        }
                    })()
            },
            100_000
        )
        expect(read).toEqual([200_000, 1_000])
    })

    it("does not charge another creation or snapshot storage for a resume", async () => {
        const usage = await collectSandboxSessionUsage(
            sandboxWith([{ requestedAt: 5_000, duration: 1_000, activeCpuDurationMs: 100 }]),
            0
        )
        expect(usage.creations).toBe(0)
        expect(usage.snapshotByteMs).toBe(0)
        expect(usage.provisionedMemoryGbMs).toBe(120_000)
    })
})

describe("unresponsive sandbox detection", () => {
    it("treats the server errors a crashed VM returns as unresponsive", () => {
        expect(isSandboxUnresponsiveError({ response: { status: 500 } })).toBe(true)
        expect(isSandboxUnresponsiveError(new Error("Status code 500 is not ok"))).toBe(true)
    })

    it("does not restart the computer for ordinary failures", () => {
        expect(isSandboxUnresponsiveError({ response: { status: 404 } })).toBe(false)
        expect(isSandboxUnresponsiveError(new Error("Command failed"))).toBe(false)
    })
})

describe("computer runs in a message", () => {
    const run = (part: Record<string, unknown>) =>
        getMessageComputerRuns({
            role: "assistant",
            parts: [{ type: "tool-computer_run", toolCallId: "call-1", ...part }]
        } as unknown as Parameters<typeof getMessageComputerRuns>[0])[0]

    it("reads a finished command", () => {
        expect(
            run({
                state: "output-available",
                input: { purpose: "Running the tests", command: "npm test" },
                output: { success: true, exitCode: 0, durationMs: 1_700, stdout: "ok" }
            })
        ).toMatchObject({ title: "Running the tests", status: "succeeded", exitCode: 0 })
    })

    it("treats a non-zero exit as failed", () => {
        expect(
            run({ state: "output-available", input: {}, output: { success: false, exitCode: 1 } })
                ?.status
        ).toBe("failed")
    })

    it("does not spin forever when a reply was cut off mid-command", () => {
        const interrupted = run({
            state: "input-available",
            input: { purpose: "Installing" },
            toolMetadata: { silkchatPersistedWithoutTerminalResult: true }
        })
        expect(interrupted?.status).toBe("failed")
        expect(interrupted?.error).toBe("No result was recorded for this step.")
    })
})
