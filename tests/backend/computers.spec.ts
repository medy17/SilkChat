import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api, internal } from "../../convex/_generated/api"
import type { Doc } from "../../convex/_generated/dataModel"
import { getHostedUsageState, recordStorageUsage } from "../../convex/credits"
import {
    COMPUTER_ARCHIVE_AFTER_MS,
    COMPUTER_SESSION_TIMEOUT_MS,
    COMPUTER_STALE_OPERATION_MS
} from "../../convex/lib/computer_policy"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")
const USER = "user-1"
const DAY_MS = 24 * 60 * 60_000
const GB = 1_000_000_000

const setup = () => convexTest(schema, modules)
type Test = ReturnType<typeof setup>

const insertComputer = (t: Test, overrides: Partial<Doc<"computers">> = {}) =>
    t.run(async (ctx) =>
        ctx.db.insert("computers", {
            userId: USER,
            authUserId: USER,
            sandboxName: "sandbox",
            driveName: "drive",
            status: "ready",
            lastUsedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...overrides
        })
    )

const readComputer = (t: Test, id: Doc<"computers">["_id"]) => t.run((ctx) => ctx.db.get(id))

describe("computer execution lock", () => {
    it("lets one command run at a time", async () => {
        const t = setup()
        await insertComputer(t)

        const first = await t.mutation(internal.computers.beginComputerExecution, {
            userId: USER,
            activityLeaseId: "first"
        })
        const second = await t.mutation(internal.computers.beginComputerExecution, {
            userId: USER,
            activityLeaseId: "second"
        })

        expect(first.ok).toBe(true)
        expect(second).toEqual({ ok: false, reason: "busy" })
    })

    it("refuses a command while the computer is going to sleep", async () => {
        const t = setup()
        await insertComputer(t, { sessionState: "stopping" })

        expect(
            await t.mutation(internal.computers.beginComputerExecution, {
                userId: USER,
                activityLeaseId: "late"
            })
        ).toEqual({ ok: false, reason: "busy" })
    })

    it("ignores a command finishing after a user action took over", async () => {
        const t = setup()
        const id = await insertComputer(t)
        await t.mutation(internal.computers.beginComputerExecution, {
            userId: USER,
            activityLeaseId: "command"
        })
        await t.mutation(internal.computers.claimComputerOperation, {
            userId: USER,
            operation: "restart"
        })

        const finished = await t.mutation(internal.computers.finishComputerExecution, {
            computerId: id,
            activityLeaseId: "command"
        })

        expect(finished).toBe(false)
        expect((await readComputer(t, id))?.operation).toBe("restart")
    })

    it("only lets the latest idle timer put the computer to sleep", async () => {
        const t = setup()
        const id = await insertComputer(t, { sessionState: "running", activityLeaseId: "current" })

        expect(
            await t.mutation(internal.computers.claimComputerIdleStop, {
                computerId: id,
                activityLeaseId: "old"
            })
        ).toBeNull()
        expect(
            await t.mutation(internal.computers.claimComputerIdleStop, {
                computerId: id,
                activityLeaseId: "current"
            })
        ).not.toBeNull()
        expect((await readComputer(t, id))?.sessionState).toBe("stopping")
    })

    it("won't archive a computer that is running a command", async () => {
        const t = setup()
        const id = await insertComputer(t, {
            executionInProgress: true,
            lastUsedAt: Date.now() - COMPUTER_ARCHIVE_AFTER_MS - DAY_MS
        })

        expect(
            await t.mutation(internal.computers.claimComputerArchive, { computerId: id })
        ).toBeNull()
    })
})

describe("computer reconcile", () => {
    const list = (t: Test) =>
        t.query(internal.computers.listComputersNeedingReconcile, { now: Date.now() })

    it("frees a lock left by a dead action, even on a computer with no session", async () => {
        const t = setup()
        const stale = Date.now() - COMPUTER_STALE_OPERATION_MS - 1
        const ready = await insertComputer(t, { executionInProgress: true, updatedAt: stale })
        const archived = await insertComputer(t, {
            status: "archived",
            executionInProgress: true,
            updatedAt: stale
        })
        await insertComputer(t, { executionInProgress: true })

        const { stale: found } = await list(t)

        expect(found.map(({ _id }) => _id).sort()).toEqual([ready, archived].sort())
    })

    it("finds a stuck computer among many idle ones", async () => {
        const t = setup()
        const old = Date.now() - COMPUTER_ARCHIVE_AFTER_MS / 2
        for (let index = 0; index < 120; index += 1) {
            await insertComputer(t, {
                sessionState: "stopped",
                lastUsedAt: old - index,
                updatedAt: old - index
            })
        }
        const stuck = await insertComputer(t, {
            sessionState: "stuck",
            updatedAt: Date.now() - COMPUTER_SESSION_TIMEOUT_MS - 1
        })

        const { stale } = await list(t)

        expect(stale.map(({ _id }) => _id)).toEqual([stuck])
    })

    it("lists a computer in several stale states once", async () => {
        const t = setup()
        const id = await insertComputer(t, {
            sessionState: "running",
            executionInProgress: true,
            operation: "sleep",
            updatedAt: Date.now() - COMPUTER_SESSION_TIMEOUT_MS - 1
        })

        const { stale } = await list(t)

        expect(stale.map(({ _id }) => _id)).toEqual([id])
    })

    it("leaves a healthy awake computer alone", async () => {
        const t = setup()
        await insertComputer(t, { sessionState: "running" })

        expect((await list(t)).stale).toEqual([])
    })
})

describe("computer storage charges", () => {
    const events = (t: Test) =>
        t.run((ctx) =>
            ctx.db
                .query("prototypeCreditEvents")
                .withIndex("byUserPeriod", (q) => q.eq("userId", USER))
                .collect()
        )

    it("charges what built up since the last charge, once", async () => {
        const t = setup()
        await insertComputer(t, {
            driveUsedBytes: 2 * GB,
            snapshotBytes: GB,
            storageMeasuredAt: Date.now() - DAY_MS,
            storageChargedAt: Date.now() - 30 * DAY_MS
        })

        await t.mutation(internal.computers.chargeComputerStorage, {})
        await t.mutation(internal.computers.chargeComputerStorage, {})

        const charged = await events(t)
        // $0.10 for the Drive and $0.08 for the snapshot, for a whole month.
        expect(charged[0].settledMicrousd).toBeGreaterThanOrEqual(179_000)
        expect(charged[0].settledMicrousd).toBeLessThanOrEqual(181_000)
        expect(charged.reduce((sum, event) => sum + (event.settledMicrousd ?? 0), 0)).toBeLessThan(
            181_000
        )
    })

    it("doesn't charge a computer that has never been measured", async () => {
        const t = setup()
        await insertComputer(t)

        await t.mutation(internal.computers.chargeComputerStorage, {})

        expect(await events(t)).toEqual([])
    })

    it("counts toward the month without opening a 5-hour window", async () => {
        const t = setup()
        const now = Date.now()
        const usage = await t.run(async (ctx) => {
            await recordStorageUsage(ctx, {
                userId: USER,
                messageKey: "storage",
                amountMicrousd: 40_000,
                now
            })
            const [event] = await ctx.db.query("prototypeCreditEvents").collect()
            return await getHostedUsageState(ctx, {
                userId: USER,
                periodKey: event.periodKey,
                periodStartsAt: 0,
                plan: "free",
                account: null,
                now
            })
        })

        expect(usage.monthlyUsedMicrousd).toBe(40_000)
        expect(usage.fiveHourUsedMicrousd).toBe(0)
    })

    it("keeps the last reading when a measurement fails", async () => {
        const t = setup()
        const id = await insertComputer(t, {
            driveUsedBytes: GB,
            snapshotBytes: GB,
            storageMeasuredAt: 1
        })

        await t.mutation(internal.computers.recordComputerStorage, {
            computerId: id,
            snapshotBytes: 0
        })

        const computer = await readComputer(t, id)
        expect(computer?.driveUsedBytes).toBe(GB)
        expect(computer?.snapshotBytes).toBe(0)
        expect(computer?.storageMeasuredAt).toBe(1)
    })
})

describe("computers over their plan's storage limit", () => {
    // The default free allowance of $0.50 gives a 5 GB limit, and Pro the full 20 GB.
    const upgrade = (t: Test) =>
        t.run((ctx) =>
            ctx.db.insert("prototypeCreditAccounts", {
                userId: USER,
                enabled: true,
                plan: "pro",
                updatedAt: 1
            })
        )
    const record = (t: Test, computerId: Doc<"computers">["_id"], driveUsedBytes: number) =>
        t.mutation(internal.computers.recordComputerStorage, { computerId, driveUsedBytes })
    const listed = (t: Test) => t.query(internal.computers.listComputersOverLimit, {})

    it("starts one countdown and keeps it across later readings", async () => {
        const t = setup()
        const id = await insertComputer(t)

        await record(t, id, 6 * GB)
        const started = (await readComputer(t, id))?.overLimitSince
        await new Promise((resolve) => setTimeout(resolve, 5))
        await record(t, id, 7 * GB)

        expect(started).toBeTypeOf("number")
        expect((await readComputer(t, id))?.overLimitSince).toBe(started)
    })

    it("ends the countdown and resets its warnings when a reading is back under", async () => {
        const t = setup()
        const id = await insertComputer(t, { overLimitSince: 1, overLimitWarningsSent: 2 })

        await record(t, id, 4 * GB)

        const computer = await readComputer(t, id)
        expect(computer?.overLimitSince).toBeUndefined()
        expect(computer?.overLimitWarningsSent).toBeUndefined()
    })

    it("stops a purge the moment the user upgrades", async () => {
        const t = setup()
        await insertComputer(t, { overLimitSince: 1, driveUsedBytes: 6 * GB })
        expect(await listed(t)).toHaveLength(1)

        await upgrade(t)

        expect(await listed(t)).toEqual([])
        expect(
            await t.query(internal.computers.getComputerOverLimitNotice, { userId: USER })
        ).toBeNull()
    })

    it("starts a countdown after a downgrade, with no new reading", async () => {
        const t = setup()
        const id = await insertComputer(t, {
            driveUsedBytes: 6 * GB,
            storageMeasuredAt: Date.now()
        })

        await t.mutation(internal.computers.chargeComputerStorage, {})

        expect((await readComputer(t, id))?.overLimitSince).toBeTypeOf("number")
    })

    it("leaves a Pro computer with the same files alone", async () => {
        const t = setup()
        await upgrade(t)
        const id = await insertComputer(t)

        await record(t, id, 6 * GB)

        expect((await readComputer(t, id))?.overLimitSince).toBeUndefined()
    })

    it("tells Silky the deadline while the computer is over", async () => {
        const t = setup()
        await insertComputer(t, { overLimitSince: 1_000, driveUsedBytes: 6 * GB })

        const notice = await t.query(internal.computers.getComputerOverLimitNotice, {
            userId: USER
        })

        expect(notice?.usedBytes).toBe(6 * GB)
        expect(notice?.deletesAt).toBe(1_000 + 35 * DAY_MS)
    })
})

describe("computer keys", () => {
    const insertKey = (t: Test, overrides: Partial<Doc<"computerKeys">> = {}) =>
        t.run((ctx) =>
            ctx.db.insert("computerKeys", {
                userId: USER,
                presetId: "github",
                label: "GitHub",
                valueEncrypted: "encrypted",
                lastFour: "abcd",
                enabled: true,
                createdAt: 1,
                updatedAt: 1,
                ...overrides
            })
        )

    it("records a key change so the next command can't run on the old policy", async () => {
        const t = setup()
        const id = await insertComputer(t)
        const keyId = await insertKey(t)

        await t
            .withIdentity({ subject: USER })
            .mutation(api.computer_keys.setMyComputerKeyEnabled, { keyId, enabled: false })

        expect((await readComputer(t, id))?.keysChangedAt).toBeTypeOf("number")
    })

    it("clears the old expiry when a key is replaced", async () => {
        const t = setup()
        await insertComputer(t)
        const keyId = await insertKey(t, { expiresAt: 1 })
        process.env.API_KEY_ENCRYPTION_SECRET ??= "test-secret-test-secret-test-secret"

        await t
            .withIdentity({ subject: USER })
            .mutation(api.computer_keys.replaceMyComputerKey, { keyId, value: "new-key-1234" })

        const key = await t.run((ctx) => ctx.db.get(keyId))
        expect(key?.expiresAt).toBeUndefined()
        expect(key?.lastFour).toBe("1234")
    })

    it("removes every key when the account's computer data is deleted", async () => {
        const t = setup()
        await insertKey(t)
        await insertKey(t, { presetId: "openai", label: "OpenAI" })

        await t.mutation(internal.computer_keys.deleteComputerKeysForUser, { userId: USER })

        expect(await t.run((ctx) => ctx.db.query("computerKeys").collect())).toEqual([])
    })
})

describe("old bundles during a deploy", () => {
    it("still answer the queries an open tab subscribes to", async () => {
        const t = setup()
        const threadId = await t.run((ctx) =>
            ctx.db.insert("threads", { authorId: USER, title: "Chat", createdAt: 1, updatedAt: 1 })
        )

        expect(await t.query(api.persistent_sandboxes.getMyActivePersistentSandbox, {})).toBeNull()
        expect(
            await t.query(api.messages.getPersistentSandboxCardResult, {
                threadId,
                messageId: "message",
                toolCallId: "tool",
                cardId: "card"
            })
        ).toBeNull()
    })
})
