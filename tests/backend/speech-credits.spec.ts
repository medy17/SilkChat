import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (fn: unknown) => fn,
    internalQuery: (fn: unknown) => fn,
    mutation: (fn: unknown) => fn,
    query: (fn: unknown) => fn
}))
vi.mock("../../convex/_generated/api", () => ({
    internal: {
        credits: {
            reserveCreditForMessage: "reserve",
            commitReservedCreditForMessage: "commit",
            releaseReservedCreditForMessage: "release"
        }
    }
}))
import { FISH_SPEECH_MODEL } from "../../convex/lib/models/fish_audio"
import { consume, release, speechCostMicrousd } from "../../convex/speech_audio"
import {
    reserveCreditForMessage,
    commitReservedCreditForMessage,
    releaseReservedCreditForMessage
} from "../../convex/credits"

// Run the real speech and credit mutations against a small indexed record store.
// This exercises balance and idempotence, rather than mocking billing decisions.
type Row = Record<string, any>
const invoke = (fn: unknown, ctx: unknown, args: unknown): Promise<any> =>
    (fn as { handler: (ctx: unknown, args: unknown) => Promise<any> }).handler(ctx, args)
function fixture() {
    const tables = new Map<string, Row[]>()
    const rows = (name: string) => {
        if (!tables.has(name)) tables.set(name, [])
        return tables.get(name)!
    }
    let counter = 0
    const db = {
        get: async (id: string) =>
            [...tables.values()].flat().find((row) => row._id === id) ?? null,
        insert: async (table: string, data: Row) => {
            const _id = `${table}-${++counter}`
            rows(table).push({ ...data, _id })
            return _id
        },
        patch: async (id: string, data: Row) => Object.assign((await db.get(id))!, data),
        delete: async (id: string) => {
            for (const records of tables.values()) {
                const index = records.findIndex((row) => row._id === id)
                if (index >= 0) records.splice(index, 1)
            }
        },
        query: (table: string) => ({
            withIndex: (_index: string, apply: (q: any) => unknown) => {
                const matches: [string, unknown][] = []
                const q = {
                    eq: (field: string, value: unknown) => {
                        matches.push([field, value])
                        return q
                    }
                }
                apply(q)
                const selected = () =>
                    rows(table).filter((row) => matches.every(([key, value]) => row[key] === value))
                return { first: async () => selected()[0] ?? null, collect: async () => selected() }
            }
        })
    }
    const functions: Record<string, unknown> = {
        reserve: reserveCreditForMessage,
        commit: commitReservedCreditForMessage,
        release: releaseReservedCreditForMessage
    }
    const ctx = {
        db,
        scheduler: { runAfter: vi.fn() },
        runMutation: (name: string, args: unknown): Promise<any> =>
            invoke(functions[name], ctx, args)
    }
    const lease = async () => {
        const acquiredAt = Date.now()
        const leaseId = await db.insert("rateLimit", {
            key: "speech:user-1",
            count: 1,
            lastRequest: acquiredAt
        })
        return {
            userId: "user-1",
            acquiredAt,
            leaseId,
            threadId: "thread-1",
            messageId: "message-1",
            text: "Hello.",
            cached: false
        }
    }
    return { ctx, rows, lease }
}
afterEach(() => vi.unstubAllEnvs())

describe("speech credit accounting", () => {
    it("reserves once, rejects a reused ticket, and commits only one charge on duplicate completion", async () => {
        const f = fixture()
        const args = await f.lease()
        expect(await invoke(consume, f.ctx, args)).toMatchObject({ allowed: true })
        expect(await invoke(consume, f.ctx, args)).toMatchObject({ allowed: false })
        expect(f.rows("prototypeCreditReservations")).toHaveLength(1)
        expect(f.rows("prototypeCreditEvents")).toHaveLength(0)
        await invoke(release, f.ctx, { ...args, complete: true })
        await invoke(release, f.ctx, { ...args, complete: true })
        expect(f.rows("prototypeCreditEvents")).toHaveLength(1)
        expect(f.rows("prototypeCreditEvents")[0]).toMatchObject({
            feature: "speech",
            counted: true,
            settledMicrousd: 132
        })
        expect(f.rows("prototypeCreditReservations")[0].active).toBe(false)
    })

    it("releases a failed generation, ignores late completion, and charges a fresh retry", async () => {
        const f = fixture()
        const failed = await f.lease()
        await invoke(consume, f.ctx, failed)
        await invoke(release, f.ctx, failed)
        await invoke(release, f.ctx, { ...failed, complete: true })
        expect(f.rows("prototypeCreditEvents")).toHaveLength(0)
        expect(f.rows("prototypeCreditReservations")[0].active).toBe(false)
        const retry = await f.lease()
        await invoke(consume, f.ctx, retry)
        await invoke(release, f.ctx, { ...retry, complete: true })
        expect(f.rows("prototypeCreditEvents")).toHaveLength(1)
        expect(f.rows("prototypeCreditEvents")[0].messageKey).not.toBe(`speech:${failed.leaseId}`)
    })

    it("settles provider input that was submitted before cancellation", async () => {
        const f = fixture()
        const cancelled = await f.lease()
        await invoke(consume, f.ctx, cancelled)
        await invoke(release, f.ctx, {
            ...cancelled,
            submittedCharacters: 3,
            submittedUtf8Bytes: 3
        })
        expect(f.rows("prototypeCreditEvents")).toHaveLength(1)
        expect(f.rows("prototypeCreditEvents")[0]).toMatchObject({
            feature: "speech",
            settledMicrousd: 66
        })
    })

    it("blocks new synthesis at the usage limit but permits cached playback without a reservation", async () => {
        vi.stubEnv("HOSTED_USAGE_5H_USD_FREE", "0")
        const f = fixture()
        const args = await f.lease()
        expect(await invoke(consume, f.ctx, args)).toMatchObject({
            allowed: false,
            reason: "usage"
        })
        expect(await invoke(consume, f.ctx, { ...args, cached: true })).toMatchObject({
            allowed: true
        })
        await invoke(release, f.ctx, { ...args, complete: true })
        expect(f.rows("prototypeCreditReservations")).toHaveLength(0)
        expect(f.rows("prototypeCreditEvents")).toHaveLength(0)
    })

    it("recovers an abandoned reservation without creating a charge", async () => {
        const f = fixture()
        await invoke(consume, f.ctx, await f.lease())
        const [, fn, args] = f.ctx.scheduler.runAfter.mock.calls[0]
        await f.ctx.runMutation(fn, args)
        expect(f.rows("prototypeCreditReservations")[0].active).toBe(false)
        expect(f.rows("prototypeCreditEvents")).toHaveLength(0)
    })

    it("meters UTF-8 byte-priced speech without treating multibyte text as ASCII", () => {
        expect(speechCostMicrousd("Hello", FISH_SPEECH_MODEL.speech)).toBe(75)
        expect(speechCostMicrousd("😀", FISH_SPEECH_MODEL.speech)).toBe(60)
    })

    it("prices the actual submitted characters, excluding chunk separator whitespace", () => {
        expect(speechCostMicrousd("  Hello.  ")).toBe(132)
        expect(speechCostMicrousd("😀")).toBe(22)
        expect(speechCostMicrousd(`${"a".repeat(1800)}  ${"b".repeat(10)}`)).toBe(1810 * 22)
    })
})
