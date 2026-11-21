import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return { v: new Proxy({}, { get: () => passthrough }) }
})

vi.mock("../../convex/_generated/server", () => ({
    internalAction: (config: unknown) => config,
    internalMutation: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({ internal: { freemius: {} } }))

vi.mock("../../convex/auth", () => ({
    betterAuthComponent: { adapter: { findOne: "betterAuth.adapter.findOne" } },
    getAppUserId: (user: { _id: string; userId?: string }) => user.userId ?? user._id
}))

import { applyFreemiusUserState } from "../../convex/freemius"
import {
    type FreemiusLicenseSnapshot,
    getFreemiusPlan,
    isFreemiusSyncEvent,
    parseFreemiusLicense,
    parseFreemiusWebhookEvent,
    verifyFreemiusSignature
} from "../../convex/lib/freemius"

type Row = Record<string, unknown> & { _id: string }

// A tiny in-memory stand-in for ctx.db that honors equality index lookups.
const createDb = () => {
    const tables = new Map<string, Row[]>()
    let nextId = 0
    const rows = (table: string) => {
        if (!tables.has(table)) tables.set(table, [])
        return tables.get(table) as Row[]
    }
    const findTable = (id: string) =>
        [...tables.entries()].find(([, list]) => list.some((row) => row._id === id))

    return {
        rows,
        db: {
            query: (table: string) => ({
                withIndex: (
                    _index: string,
                    build: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
                ) => {
                    const filters: [string, unknown][] = []
                    const q = {
                        eq: (field: string, value: unknown) => {
                            filters.push([field, value])
                            return q
                        }
                    }
                    build(q)
                    const matches = () =>
                        rows(table).filter((row) =>
                            filters.every(([field, value]) => row[field] === value)
                        )
                    return {
                        first: async () => matches()[0] ?? null,
                        collect: async () => matches()
                    }
                }
            }),
            insert: async (table: string, value: Record<string, unknown>) => {
                const row = { ...value, _id: `${table}:${nextId++}` }
                rows(table).push(row)
                return row._id
            },
            patch: async (id: string, value: Record<string, unknown>) => {
                const [, list] = findTable(id) ?? []
                const row = list?.find((entry) => entry._id === id)
                if (row) Object.assign(row, value)
            },
            replace: async (id: string, value: Record<string, unknown>) => {
                const [, list] = findTable(id) ?? []
                const index = list?.findIndex((entry) => entry._id === id) ?? -1
                if (list && index >= 0) list[index] = { ...value, _id: id }
            },
            delete: async (id: string) => {
                const [table, list] = findTable(id) ?? []
                if (table && list)
                    tables.set(
                        table,
                        list.filter((entry) => entry._id !== id)
                    )
            }
        }
    }
}

const authUsers = [{ _id: "auth-1", userId: "user-1", email: "ahmed@example.com" }]

const createCtx = () => {
    const store = createDb()
    return {
        store,
        ctx: {
            db: store.db,
            runQuery: async (_ref: unknown, args: { where: { field: string; value: string }[] }) =>
                authUsers.find((user) => user.email === args.where[0]?.value) ?? null
        }
    }
}

const applyState = applyFreemiusUserState as unknown as {
    handler: (
        ctx: ReturnType<typeof createCtx>["ctx"],
        args: { fsUserId: string; email?: string; licenses: FreemiusLicenseSnapshot[] }
    ) => Promise<{ status: string; plan?: string }>
}

const hmacHex = async (body: string, secret: string) => {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
}

const NOW = Date.parse("2026-12-01T00:00:00Z")
const license = (overrides: Partial<FreemiusLicenseSnapshot> = {}): FreemiusLicenseSnapshot => ({
    fsLicenseId: "license-1",
    fsPlanId: "plan-pro",
    expiresAt: Date.parse("2027-01-01T00:00:00Z"),
    isCancelled: false,
    isSandbox: false,
    ...overrides
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe("Freemius webhook signature", () => {
    it("accepts only an HMAC of the exact raw body", async () => {
        const body = JSON.stringify({ id: "1", type: "license.created" })
        const signature = await hmacHex(body, "secret")

        expect(await verifyFreemiusSignature({ rawBody: body, secret: "secret", signature })).toBe(
            true
        )
        expect(
            await verifyFreemiusSignature({ rawBody: `${body} `, secret: "secret", signature })
        ).toBe(false)
        expect(
            await verifyFreemiusSignature({ rawBody: body, secret: "secret", signature: null })
        ).toBe(false)
    })
})

describe("Freemius webhook events", () => {
    it("finds the Freemius user on whichever object the event carries", () => {
        expect(
            parseFreemiusWebhookEvent({
                id: 77,
                type: "license.expired",
                objects: { license: { id: 5, user_id: 42 } }
            })
        ).toEqual({ eventId: "77", eventType: "license.expired", fsUserId: "42" })
        expect(parseFreemiusWebhookEvent({ type: "license.created" })).toBeNull()
    })

    it("resyncs on license, subscription, and payment events only", () => {
        expect(isFreemiusSyncEvent("license.plan.changed")).toBe(true)
        expect(isFreemiusSyncEvent("payment.refund")).toBe(true)
        expect(isFreemiusSyncEvent("subscription.cancelled")).toBe(true)
        expect(isFreemiusSyncEvent("user.marketing.opted_in")).toBe(false)
        expect(isFreemiusSyncEvent("cart.abandoned")).toBe(false)
    })
})

describe("Freemius license plan", () => {
    it("reads API licenses with UTC expirations and lifetime licenses", () => {
        expect(
            parseFreemiusLicense({
                id: 9,
                plan_id: 3,
                pricing_id: 4,
                expiration: "2027-01-01 00:00:00",
                is_cancelled: false,
                environment: 1
            })
        ).toEqual({
            fsLicenseId: "9",
            fsPlanId: "3",
            fsPricingId: "4",
            expiresAt: Date.parse("2027-01-01T00:00:00Z"),
            isCancelled: false,
            isSandbox: true
        })
        expect(parseFreemiusLicense({ id: 9, plan_id: 3, expiration: null })?.expiresAt).toBe(
            undefined
        )
    })

    it("grants Pro only for an uncancelled, unexpired license", () => {
        const options = { allowSandbox: false }
        expect(getFreemiusPlan([license()], NOW, options)).toBe("pro")
        expect(getFreemiusPlan([license({ expiresAt: undefined })], NOW, options)).toBe("pro")
        expect(getFreemiusPlan([license({ isCancelled: true })], NOW, options)).toBe("free")
        expect(getFreemiusPlan([license({ expiresAt: NOW - 1 })], NOW, options)).toBe("free")
    })

    it("ignores sandbox licenses unless sandbox is allowed", () => {
        const sandbox = license({ isSandbox: true })
        expect(getFreemiusPlan([sandbox], NOW, { allowSandbox: false })).toBe("free")
        expect(getFreemiusPlan([sandbox], NOW, { allowSandbox: true })).toBe("pro")
    })
})

describe("applyFreemiusUserState", () => {
    it("binds by email on first sync and keeps the binding afterwards", async () => {
        const { ctx, store } = createCtx()

        const first = await applyState.handler(ctx, {
            fsUserId: "fs-1",
            email: "ahmed@example.com",
            licenses: [license()]
        })
        expect(first).toMatchObject({ status: "synced", plan: "pro" })
        expect(store.rows("prototypeCreditAccounts")[0]).toMatchObject({
            userId: "user-1",
            plan: "pro"
        })

        // Later syncs follow the stored binding, even with a different email.
        const second = await applyState.handler(ctx, {
            fsUserId: "fs-1",
            email: "changed@example.com",
            licenses: [license()]
        })
        expect(second).toMatchObject({ status: "synced", plan: "pro" })
        expect(store.rows("freemiusCustomers")).toHaveLength(1)
    })

    it("converges on the latest state no matter how many times it runs", async () => {
        const { ctx, store } = createCtx()
        const args = { fsUserId: "fs-1", email: "ahmed@example.com" }

        await applyState.handler(ctx, { ...args, licenses: [license()] })
        await applyState.handler(ctx, { ...args, licenses: [license()] })
        expect(store.rows("freemiusLicenses")).toHaveLength(1)

        // The license expired on Freemius: the next sync downgrades.
        await applyState.handler(ctx, {
            ...args,
            licenses: [license({ expiresAt: Date.now() - 1000 })]
        })
        expect(store.rows("prototypeCreditAccounts")[0]?.plan).toBe("free")

        // The license was deleted on Freemius: the next sync drops it.
        await applyState.handler(ctx, { ...args, licenses: [] })
        expect(store.rows("freemiusLicenses")).toHaveLength(0)
    })

    it("stores licenses but grants nothing when no account matches", async () => {
        const { ctx, store } = createCtx()

        const result = await applyState.handler(ctx, {
            fsUserId: "fs-2",
            email: "stranger@example.com",
            licenses: [license()]
        })

        expect(result).toMatchObject({ status: "unbound" })
        expect(store.rows("freemiusLicenses")[0]?.userId).toBeUndefined()
        expect(store.rows("prototypeCreditAccounts")).toHaveLength(0)
    })

    it("keeps a sandbox purchase on Free unless sandbox is allowed", async () => {
        const args = { fsUserId: "fs-1", email: "ahmed@example.com" }

        const prod = createCtx()
        await applyState.handler(prod.ctx, { ...args, licenses: [license({ isSandbox: true })] })
        expect(prod.store.rows("prototypeCreditAccounts")[0]?.plan).toBe("free")

        vi.stubEnv("FREEMIUS_ALLOW_SANDBOX", "1")
        const dev = createCtx()
        await applyState.handler(dev.ctx, { ...args, licenses: [license({ isSandbox: true })] })
        expect(dev.store.rows("prototypeCreditAccounts")[0]?.plan).toBe("pro")
    })
})
