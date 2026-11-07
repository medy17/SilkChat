import { beforeEach, describe, expect, it, vi } from "vitest"

const { sandboxGet, sandboxCreate, driveGet, driveGetOrCreate, sendEmail } = vi.hoisted(() => ({
    sendEmail: vi.fn(),
    sandboxGet: vi.fn(),
    sandboxCreate: vi.fn(),
    driveGet: vi.fn(),
    driveGetOrCreate: vi.fn()
}))

vi.mock("@vercel/sandbox", () => ({
    Sandbox: { get: sandboxGet, create: sandboxCreate },
    Drive: { get: driveGet, getOrCreate: driveGetOrCreate }
}))

vi.mock("../../convex/_generated/server", () => ({
    action: (config: unknown) => config,
    internalAction: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => {
    const reference = (path: string): unknown =>
        new Proxy(
            {},
            {
                get: (_target, key) =>
                    key === "toString" || key === Symbol.toPrimitive
                        ? () => path
                        : reference(path ? `${path}.${String(key)}` : String(key))
            }
        )
    return { internal: reference(""), api: reference("") }
})

vi.mock("../../convex/auth", () => ({
    authComponent: {
        adapter: () => () => ({
            findOne: async () => ({ email: "user@example.com", emailVerified: true })
        })
    }
}))
vi.mock("../../src/lib/email", () => ({ sendComputerDeletionNoticeEmail: sendEmail }))
vi.mock("../../convex/lib/account_deletion_gate", () => ({
    assertAccountNotDeletingForAction: vi.fn()
}))
vi.mock("../../convex/lib/identity", () => ({ getUserIdentity: vi.fn() }))
vi.mock("../../convex/lib/encryption", () => ({
    decryptKey: vi.fn(async () => "secret")
}))
vi.mock("../../convex/lib/tools/code_execution_node", () => ({
    collectCommandOutput: async (command: {
        stdout: () => Promise<string>
        stderr: () => Promise<string>
    }) => ({
        stdout: await command.stdout(),
        stderr: await command.stderr(),
        outputTruncated: false
    }),
    exportSandboxArtifacts: async () => ({ artifacts: [], artifactErrors: [] }),
    getVercelSandboxCredentials: () => ({ teamId: "team", projectId: "project", token: "token" })
}))

import {
    deleteComputerForUser,
    executeOnComputer,
    runComputerRetention,
    suspendIdleComputer
} from "../../convex/computers_node"
import { COMPUTER_SESSION_ROLLOVER_MS } from "../../convex/lib/computer_policy"

type Handler = { handler: (ctx: any, args: any) => Promise<any> }
const execute = (ctx: unknown, command = "git push") =>
    (executeOnComputer as unknown as Handler).handler(ctx, { userId: "user-1", command })

const SERVER_ERROR = Object.assign(new Error("Status code 500 is not ok"), {
    response: { status: 500 }
})

const finishedCommand = (overrides: Record<string, unknown> = {}) => ({
    exitCode: 0,
    durationMs: 10,
    stdout: async () => "pushed",
    stderr: async () => "",
    ...overrides
})

const createSandbox = (overrides: Record<string, unknown> = {}) => ({
    status: "running",
    fs: { mkdir: vi.fn(async () => undefined), rm: vi.fn(async () => undefined) },
    runCommand: vi.fn(async () => finishedCommand()),
    stop: vi.fn(async () => ({})),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    listSessions: vi.fn(async () => (async function* () {})()),
    ...overrides
})

const createRecord = (overrides: Record<string, unknown> = {}) => ({
    _id: "computer-1",
    userId: "user-1",
    authUserId: "user-1",
    sandboxName: "sandbox",
    driveName: "drive",
    status: "ready",
    ...overrides
})

const createCtx = (record: Record<string, unknown>, queries: Record<string, unknown> = {}) => {
    const mutations: string[] = []
    return {
        mutations,
        scheduler: {
            runAfter: vi.fn(async () => "scheduled-id"),
            cancel: vi.fn(async () => undefined)
        },
        runMutation: vi.fn(async (reference: unknown) => {
            const name = String(reference)
            mutations.push(name)
            if (name.endsWith("beginComputerExecution")) return { ok: true, record }
            if (name.endsWith("claimComputerIdleStop")) return record
            if (name.endsWith("claimComputerDeletion")) return record
            if (name.endsWith("reserveCreditForMessage")) return { allowed: true }
            return undefined
        }),
        runQuery: vi.fn(async (reference: unknown) => {
            const name = String(reference)
            const stubbed = Object.keys(queries).find((key) => name.endsWith(key))
            if (stubbed) return queries[stubbed]
            if (name.endsWith("listEnabledComputerKeys")) return []
            if (name.endsWith("getComputerForUser")) return record
            if (name.endsWith("getUserCreditPlanInternal")) return "free"
            return undefined
        })
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("running a command on the computer", () => {
    it("never reruns a command when the VM stops answering part way through", async () => {
        const sandbox = createSandbox({
            runCommand: vi.fn(async () => {
                throw SERVER_ERROR
            })
        })
        sandboxGet.mockResolvedValue(sandbox)

        const result = await execute(createCtx(createRecord()))

        expect(sandbox.runCommand).toHaveBeenCalledTimes(1)
        expect(sandbox.stop).not.toHaveBeenCalled()
        expect(result.success).toBe(false)
        expect(result.error).toContain("may or may not have finished")
    })

    it("restarts a crashed VM before the command starts, then runs it once", async () => {
        const crashed = createSandbox({
            fs: {
                mkdir: vi.fn(async () => {
                    throw SERVER_ERROR
                }),
                rm: vi.fn(async () => undefined)
            }
        })
        const restarted = createSandbox()
        sandboxGet.mockResolvedValueOnce(crashed).mockResolvedValueOnce(restarted)

        const result = await execute(createCtx(createRecord()))

        expect(crashed.stop).toHaveBeenCalled()
        expect(crashed.runCommand).not.toHaveBeenCalled()
        expect(restarted.runCommand).toHaveBeenCalledTimes(1)
        expect(result.success).toBe(true)
    })

    it("marks the computer stuck when a restart doesn't help", async () => {
        const broken = () =>
            createSandbox({
                fs: {
                    mkdir: vi.fn(async () => {
                        throw SERVER_ERROR
                    }),
                    rm: vi.fn(async () => undefined)
                }
            })
        sandboxGet.mockResolvedValueOnce(broken()).mockResolvedValueOnce(broken())
        const ctx = createCtx(createRecord())

        const result = await execute(ctx)

        expect(result.success).toBe(false)
        expect(ctx.runMutation).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ stuck: true })
        )
    })

    it("reports a finished command as finished when its output can't be read", async () => {
        const sandbox = createSandbox({
            runCommand: vi.fn(async () =>
                finishedCommand({
                    stdout: async () => {
                        throw SERVER_ERROR
                    }
                })
            )
        })
        sandboxGet.mockResolvedValue(sandbox)

        const result = await execute(createCtx(createRecord()))

        expect(sandbox.runCommand).toHaveBeenCalledTimes(1)
        expect(result).toMatchObject({ success: true, exitCode: 0, outputUnavailable: true })
    })

    it("runs nothing if a key change can't reach the sandbox", async () => {
        const sandbox = createSandbox({
            update: vi.fn(async () => {
                throw new Error("policy update failed")
            })
        })
        sandboxGet.mockResolvedValue(sandbox)

        const result = await execute(createCtx(createRecord({ keysChangedAt: 10 })))

        expect(sandbox.runCommand).not.toHaveBeenCalled()
        expect(result.success).toBe(false)
        expect(result.error).toContain("nothing ran")
    })

    it("sends a pending key change before the command runs", async () => {
        const sandbox = createSandbox()
        sandboxGet.mockResolvedValue(sandbox)

        await execute(createCtx(createRecord({ keysChangedAt: 10, keysAppliedAt: 5 })))

        expect(sandbox.update.mock.invocationCallOrder[0]).toBeLessThan(
            sandbox.runCommand.mock.invocationCallOrder[0]
        )
    })

    it("warns Silky in the result while the computer is over its storage limit", async () => {
        sandboxGet.mockResolvedValue(createSandbox())
        const ctx = createCtx(createRecord(), {
            getComputerOverLimitNotice: {
                usedBytes: 12_000_000_000,
                limitBytes: 10_000_000_000,
                deletesAt: Date.UTC(2026, 11, 12)
            }
        })

        const result = await execute(ctx)

        expect(result.success).toBe(true)
        expect(result.storageWarning).toContain("12.0 GB used of 10.0 GB")
        expect(result.storageWarning).toContain("2026-12-12")
    })

    it("closes an old billing window and re-checks credit before the next command", async () => {
        const sandbox = createSandbox()
        sandboxGet.mockResolvedValue(sandbox)
        const ctx = createCtx(
            createRecord({
                billingMessageKey: "old-window",
                billingStartedAt: Date.now() - COMPUTER_SESSION_ROLLOVER_MS,
                reservedMicrousd: 100
            })
        )

        await execute(ctx)

        expect(sandbox.stop).toHaveBeenCalled()
        expect(
            ctx.mutations.filter((name) => name.endsWith("reserveCreditForMessage"))
        ).toHaveLength(1)
    })

    it("stops when the user has no credit left for a new window", async () => {
        const sandbox = createSandbox()
        sandboxGet.mockResolvedValue(sandbox)
        const ctx = createCtx(
            createRecord({ billingMessageKey: "old-window", billingStartedAt: 1 })
        )
        const runMutation = ctx.runMutation.getMockImplementation()
        ctx.runMutation.mockImplementation(async (reference: unknown) =>
            String(reference).endsWith("reserveCreditForMessage")
                ? { allowed: false, reason: "usage" }
                : runMutation?.(reference)
        )

        const result = await execute(ctx)

        expect(sandbox.runCommand).not.toHaveBeenCalledWith(
            expect.objectContaining({ cmd: "bash" })
        )
        expect(result.error).toContain("usage limit")
    })

    it("leaves a young billing window open", async () => {
        const sandbox = createSandbox()
        sandboxGet.mockResolvedValue(sandbox)

        await execute(
            createCtx(
                createRecord({
                    billingMessageKey: "window",
                    billingStartedAt: Date.now() - 60_000
                })
            )
        )

        expect(sandbox.stop).not.toHaveBeenCalled()
    })
})

describe("rebuilding a computer on its Drive", () => {
    const rebuild = async (record: Record<string, unknown>) => {
        sandboxCreate.mockResolvedValue(createSandbox())
        await execute(createCtx(createRecord({ status: "archived", ...record })))
    }

    it("asks for a sized Drive only when the computer recorded one", async () => {
        driveGetOrCreate.mockResolvedValue({})
        await rebuild({ driveMaxBytes: 5_000_000_000 })
        expect(driveGetOrCreate).toHaveBeenCalledWith(
            expect.objectContaining({ maxSize: 5_000_000_000 })
        )
    })

    it("doesn't state a size for a Drive that predates plan limits", async () => {
        driveGet.mockResolvedValue({})
        await rebuild({})
        expect(driveGet).toHaveBeenCalled()
        expect(driveGetOrCreate).not.toHaveBeenCalled()
    })
})

describe("putting the computer to sleep", () => {
    const suspend = (ctx: unknown) =>
        (suspendIdleComputer as unknown as Handler).handler(ctx, {
            computerId: "computer-1",
            activityLeaseId: "lease"
        })

    it("records the Drive and snapshot size as it stops", async () => {
        const sandbox = createSandbox({
            runCommand: vi.fn(async () =>
                finishedCommand({ stdout: async () => "     Used\n1234567\n" })
            ),
            stop: vi.fn(async () => ({ snapshot: { sizeBytes: 800 } }))
        })
        sandboxGet.mockResolvedValue(sandbox)
        const ctx = createCtx(createRecord())

        await suspend(ctx)

        expect(ctx.runMutation).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ driveUsedBytes: 1_234_567, snapshotBytes: 800 })
        )
    })

    it("doesn't wake a computer that is already asleep just to measure it", async () => {
        const sandbox = createSandbox({ status: "stopped" })
        sandboxGet.mockResolvedValue(sandbox)

        await suspend(createCtx(createRecord()))

        expect(sandbox.runCommand).not.toHaveBeenCalled()
    })

    it("drops a snapshot past the plan limit and keeps the Drive", async () => {
        const sandbox = createSandbox()
        sandboxGet.mockResolvedValue(sandbox)

        await suspend(createCtx(createRecord({ snapshotBytes: 50_000_000_000 })))

        expect(sandbox.delete).toHaveBeenCalled()
        expect(driveGet).not.toHaveBeenCalled()
    })

    it("keeps a snapshot within the plan limit", async () => {
        const sandbox = createSandbox()
        sandboxGet.mockResolvedValue(sandbox)

        await suspend(createCtx(createRecord({ snapshotBytes: 900_000_000 })))

        expect(sandbox.delete).not.toHaveBeenCalled()
    })
})

describe("purging a computer that stayed over its storage limit", () => {
    const DAY_MS = 24 * 60 * 60_000
    const run = (ctx: unknown) => (runComputerRetention as unknown as Handler).handler(ctx, {})
    const overLimit = (days: number, overrides: Record<string, unknown> = {}) =>
        createRecord({
            overLimitSince: Date.now() - days * DAY_MS,
            overLimitWarningsSent: 3,
            ...overrides
        })
    const ctxFor = (record: Record<string, unknown>) =>
        createCtx(record, { listComputersForRetention: [], listComputersOverLimit: [record] })
    const purged = (ctx: ReturnType<typeof createCtx>) =>
        ctx.mutations.some((name) => name.endsWith("removeComputerRecord"))

    beforeEach(() => {
        sandboxGet.mockResolvedValue(createSandbox({ status: "stopped" }))
        driveGet.mockResolvedValue({ delete: vi.fn(async () => undefined) })
    })

    it("emails the user first, and doesn't purge", async () => {
        const ctx = ctxFor(overLimit(0, { overLimitWarningsSent: 0 }))

        await run(ctx)

        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ daysLeft: 35, reason: "storage" })
        )
        expect(ctx.mutations.some((name) => name.endsWith("recordComputerOverLimitWarning"))).toBe(
            true
        )
        expect(purged(ctx)).toBe(false)
    })

    it("purges once the deadline passes and every warning has gone out", async () => {
        const ctx = ctxFor(overLimit(36))

        await run(ctx)

        expect(purged(ctx)).toBe(true)
    })

    it("waits for a computer that's awake, in case it's being cleaned up", async () => {
        const ctx = ctxFor(overLimit(36, { sessionState: "running" }))

        await run(ctx)

        expect(purged(ctx)).toBe(false)
    })

    it("keeps going when one computer's step fails", async () => {
        sendEmail.mockRejectedValueOnce(new Error("mail is down"))
        const failing = overLimit(0, { overLimitWarningsSent: 0 })
        const next = overLimit(36, { _id: "computer-2" })
        const ctx = createCtx(next, {
            listComputersForRetention: [],
            listComputersOverLimit: [failing, next]
        })

        await run(ctx)

        expect(purged(ctx)).toBe(true)
    })
})

describe("deleting an account's computer", () => {
    it("removes the sandbox, the Drive, and the keys", async () => {
        const sandbox = createSandbox({ status: "stopped" })
        const drive = { delete: vi.fn(async () => undefined) }
        sandboxGet.mockResolvedValue(sandbox)
        driveGet.mockResolvedValue(drive)
        const ctx = createCtx(createRecord())

        await (deleteComputerForUser as unknown as Handler).handler(ctx, { userId: "user-1" })

        expect(sandbox.delete).toHaveBeenCalled()
        expect(drive.delete).toHaveBeenCalled()
        expect(ctx.mutations.some((name) => name.endsWith("removeComputerRecord"))).toBe(true)
        expect(ctx.mutations.some((name) => name.endsWith("deleteComputerKeysForUser"))).toBe(true)
    })
})
