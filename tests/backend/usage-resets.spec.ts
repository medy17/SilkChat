import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, components } from "../../convex/_generated/api"
import { mergeSuppressedUsageMicrousd } from "../../convex/lib/account_deletion"
import {
    getAnchoredMonthlyCreditPeriodBounds,
    getCreditPeriodKeyFromBounds
} from "../../convex/lib/credits"
import {
    computeMonthlyUsedMicrousd,
    isResetUsable,
    grantTargetsUser,
    pruneBreakpoints,
    resetCoversLimit
} from "../../convex/lib/usage_resets"
import schema from "../../convex/schema"
import authSchema from "../../node_modules/@convex-dev/better-auth/dist/component/schema.js"

const modules = import.meta.glob("../../convex/**/*.ts")
const authModules = import.meta.glob(
    "../../node_modules/@convex-dev/better-auth/dist/component/**/*.js"
)

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const record = (createdAt: number, amountMicrousd: number) => ({ createdAt, amountMicrousd })

describe("usage reset breakpoints", () => {
    const limit = 1_000_000

    it("drops usage and carried usage from before a monthly breakpoint", () => {
        expect(
            computeMonthlyUsedMicrousd({
                records: [record(10, 300_000), record(30, 100_000)],
                carriedMicrousd: 200_000,
                breakpoints: { monthlyAt: 20, weekly: [] },
                monthlyLimitMicrousd: limit
            })
        ).toBe(100_000)
    })

    it("forgives a quarter of the limit, but only from usage that existed before the reset", () => {
        const weekly = (at: number) => ({ weekly: [{ at, fraction: 0.25 }] })
        // Plenty of earlier usage: the full quarter comes off.
        expect(
            computeMonthlyUsedMicrousd({
                records: [record(10, 600_000), record(30, 100_000)],
                carriedMicrousd: 0,
                breakpoints: weekly(20),
                monthlyLimitMicrousd: limit
            })
        ).toBe(450_000)
        // Little earlier usage: a reset redeemed early can't bank headroom for later.
        expect(
            computeMonthlyUsedMicrousd({
                records: [record(10, 100_000), record(30, 500_000)],
                carriedMicrousd: 0,
                breakpoints: weekly(20),
                monthlyLimitMicrousd: limit
            })
        ).toBe(500_000)
        // Two resets can't forgive the same usage twice.
        expect(
            computeMonthlyUsedMicrousd({
                records: [record(10, 300_000)],
                carriedMicrousd: 0,
                breakpoints: {
                    weekly: [
                        { at: 20, fraction: 0.25 },
                        { at: 30, fraction: 0.25 }
                    ]
                },
                monthlyLimitMicrousd: limit
            })
        ).toBe(0)
    })

    it("ignores breakpoints from before the period and weekly ones a monthly reset supersedes", () => {
        expect(
            pruneBreakpoints(
                {
                    fiveHourAt: 5,
                    monthlyAt: 40,
                    weekly: [
                        { at: 30, fraction: 0.25 },
                        { at: 50, fraction: 0.25 }
                    ]
                },
                10
            )
        ).toEqual({ fiveHourAt: undefined, monthlyAt: 40, weekly: [{ at: 50, fraction: 0.25 }] })
    })

    it("matches global grants by plan and signup cutoff", () => {
        const grant = { scope: "global" as const, plan: "free" as const, signedUpBefore: 100 }
        expect(grantTargetsUser(grant, { userId: "a", plan: "free", signedUpAt: 100 })).toBe(true)
        expect(grantTargetsUser(grant, { userId: "a", plan: "free", signedUpAt: 101 })).toBe(false)
        expect(grantTargetsUser(grant, { userId: "a", plan: "pro", signedUpAt: 50 })).toBe(false)
    })

    it("stops a deletion merge restoring usage that a later reset forgave", () => {
        const previous = {
            usagePeriodKey: "period",
            consumedUsageMicrousd: 400_000,
            lastDeletedAt: 100
        }
        const merge = (latestResetAt?: number) =>
            mergeSuppressedUsageMicrousd({
                consumedUsageMicrousd: 50_000,
                periodKey: "period",
                latestResetAt,
                previous
            })

        // Re-creating the account can't launder usage...
        expect(merge()).toBe(400_000)
        expect(merge(50)).toBe(400_000)
        // ...but a reset after the earlier deletion already forgave it.
        expect(merge(150)).toBe(50_000)
    })

    it("makes Banked Resets usable earlier on Free than on Pro", () => {
        const usage = (fiveHourShare: number, monthlyShare: number) => ({
            fiveHourUsedMicrousd: fiveHourShare * 1_000_000,
            monthlyUsedMicrousd: monthlyShare * 1_000_000,
            limits: { fiveHourMicrousd: 1_000_000, monthlyMicrousd: 1_000_000 }
        })
        const monthly = { window: "monthly" as const, includesFiveHour: false }

        expect(isResetUsable(monthly, "free", usage(0, 0.75))).toBe(true)
        expect(isResetUsable(monthly, "pro", usage(0, 0.75))).toBe(false)
        expect(isResetUsable(monthly, "pro", usage(0, 0.9))).toBe(true)
        // A bundle needs only one of its windows past the line.
        expect(isResetUsable({ ...monthly, includesFiveHour: true }, "pro", usage(0.9, 0.1))).toBe(
            true
        )
    })

    it("offers 5-hour tickets and bundles for the 5-hour limit, longer ones for the monthly limit", () => {
        expect(resetCoversLimit({ window: "five_hour", includesFiveHour: false }, "monthly")).toBe(
            false
        )
        expect(resetCoversLimit({ window: "weekly", includesFiveHour: true }, "five_hour")).toBe(
            true
        )
        expect(resetCoversLimit({ window: "monthly", includesFiveHour: false }, "five_hour")).toBe(
            false
        )
    })
})

describe("usage resets", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-11-03T12:00:00Z"))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
    })

    async function setup() {
        const t = convexTest(schema, modules)
        t.registerComponent("betterAuth", authSchema, authModules)
        const createUser = async (email: string) => {
            const user = await t.mutation(components.betterAuth.adapter.create, {
                input: {
                    model: "user",
                    data: {
                        name: email,
                        email,
                        emailVerified: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                }
            })
            const session = await t.mutation(components.betterAuth.adapter.create, {
                input: {
                    model: "session",
                    data: {
                        userId: user._id,
                        token: crypto.randomUUID(),
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        expiresAt: Date.now() + DAY
                    }
                }
            })
            const id = user._id as string
            return { id, as: t.withIdentity({ subject: id, sessionId: session._id }) }
        }
        // Gives the user a credit account and settled usage at the current time.
        const spend = async (userId: string, microusd: number) =>
            await t.run(async (ctx) => {
                const now = Date.now()
                let account = await ctx.db
                    .query("prototypeCreditAccounts")
                    .withIndex("byUser", (q) => q.eq("userId", userId))
                    .first()
                if (!account) {
                    await ctx.db.insert("prototypeCreditAccounts", {
                        userId,
                        enabled: true,
                        plan: "free",
                        creditPeriodAnchorAt: now - DAY,
                        updatedAt: now
                    })
                    account = await ctx.db
                        .query("prototypeCreditAccounts")
                        .withIndex("byUser", (q) => q.eq("userId", userId))
                        .first()
                }
                const periodKey = getCreditPeriodKeyFromBounds(
                    getAnchoredMonthlyCreditPeriodBounds({
                        timestamp: now,
                        anchorTimestamp: account?.creditPeriodAnchorAt ?? now
                    })
                )
                await ctx.db.insert("prototypeCreditEvents", {
                    userId,
                    messageId: crypto.randomUUID(),
                    messageKey: crypto.randomUUID(),
                    providerSource: "internal",
                    feature: "chat",
                    bucket: "none",
                    units: 0,
                    counted: true,
                    accountingKind: "usage",
                    settledMicrousd: microusd,
                    periodKey,
                    createdAt: now
                })
            })
        const operator = await createUser("operator@example.com")
        vi.stubEnv("AUTH_IMPERSONATION_USER_IDS", operator.id)
        return { t, operator, createUser, spend }
    }

    type TestUser = Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["createUser"]>>

    const usageOf = async (user: TestUser) => {
        const summary = await user.as.query(api.credits.getMyCreditUsageSummary, {})
        return {
            fiveHour: summary?.usageMetering.fiveHour.usedUsd,
            monthly: summary?.usageMetering.monthly.usedUsd
        }
    }

    const globalTicket = {
        target: { kind: "global" as const },
        window: "monthly" as const,
        includesFiveHour: false,
        delivery: "banked" as const,
        expiryMonths: 3
    }

    it("lets only operators grant resets", async () => {
        const { createUser } = await setup()
        const customer = await createUser("customer@example.com")
        await expect(
            customer.as.mutation(api.usage_resets.grantUsageReset, globalTicket)
        ).rejects.toThrow("Moderator access required")
    })

    it("redeems a banked global ticket once, for users who signed up before it", async () => {
        const { operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        await spend(customer.id, 400_000)
        vi.advanceTimersByTime(HOUR)

        await operator.as.mutation(api.usage_resets.grantUsageReset, globalTicket)
        vi.advanceTimersByTime(HOUR)
        const latecomer = await createUser("late@example.com")
        await spend(latecomer.id, 80_000)
        expect(await latecomer.as.query(api.usage_resets.getMyUsageResetTickets, {})).toEqual([])

        const [ticket] = (await customer.as.query(api.usage_resets.getMyUsageResetTickets, {}))!
        expect(ticket).toMatchObject({ window: "monthly", canRedeem: true })
        await customer.as.mutation(api.usage_resets.redeemUsageReset, { grantId: ticket.id })

        // The 5-hour window wasn't part of this ticket.
        expect(await usageOf(customer)).toEqual({ fiveHour: 0.4, monthly: 0 })
        expect(await customer.as.query(api.usage_resets.getMyUsageResetTickets, {})).toEqual([])
        await expect(
            customer.as.mutation(api.usage_resets.redeemUsageReset, { grantId: ticket.id })
        ).rejects.toThrow("You've already used this reset")
    })

    it("resets one user's weekly allowance and 5-hour window straight away", async () => {
        const { operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        const neighbour = await createUser("neighbour@example.com")
        await spend(customer.id, 300_000)
        await spend(neighbour.id, 300_000)
        vi.advanceTimersByTime(HOUR)

        await operator.as.mutation(api.usage_resets.grantUsageReset, {
            target: { kind: "user", authUserId: customer.id },
            window: "weekly",
            includesFiveHour: true,
            delivery: "instant",
            expiryMonths: null
        })

        // A quarter of the free plan's default $0.50 monthly limit comes off.
        expect(await usageOf(customer)).toEqual({ fiveHour: 0, monthly: 0.175 })
        expect(await usageOf(neighbour)).toEqual({ fiveHour: 0.3, monthly: 0.3 })
    })

    it("hides revoked tickets from users who haven't used them", async () => {
        const { operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        await spend(customer.id, 80_000)
        const { grantId } = await operator.as.mutation(
            api.usage_resets.grantUsageReset,
            globalTicket
        )

        await operator.as.mutation(api.usage_resets.revokeUsageReset, { grantId })

        expect(await customer.as.query(api.usage_resets.getMyUsageResetTickets, {})).toEqual([])
        await expect(
            customer.as.mutation(api.usage_resets.redeemUsageReset, { grantId })
        ).rejects.toThrow("This reset is no longer available")
    })

    it("applies an instant global reset to existing usage and notifies the user once", async () => {
        const { operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        await spend(customer.id, 80_000)
        vi.advanceTimersByTime(HOUR)

        await operator.as.mutation(api.usage_resets.grantUsageReset, {
            ...globalTicket,
            window: "five_hour",
            delivery: "instant",
            expiryMonths: null
        })
        vi.advanceTimersByTime(HOUR)
        await spend(customer.id, 10_000)

        expect(await usageOf(customer)).toEqual({ fiveHour: 0.01, monthly: 0.09 })
        const notice = await customer.as.query(api.usage_resets.getMyUsageResetNotice, {})
        expect(notice).toMatchObject({ window: "five_hour" })
        await customer.as.mutation(api.usage_resets.dismissMyUsageResetNotice, {
            seenAt: notice!.createdAt
        })
        expect(await customer.as.query(api.usage_resets.getMyUsageResetNotice, {})).toBeNull()
    })

    it("won't let an operator viewing as the user spend their Banked Reset", async () => {
        const { t, operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        await spend(customer.id, 400_000)
        const { grantId } = await operator.as.mutation(
            api.usage_resets.grantUsageReset,
            globalTicket
        )
        const session = await t.mutation(components.betterAuth.adapter.create, {
            input: {
                model: "session",
                data: {
                    userId: customer.id,
                    token: crypto.randomUUID(),
                    impersonatedBy: operator.id,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    expiresAt: Date.now() + DAY
                }
            }
        })
        const viewingAs = t.withIdentity({ subject: customer.id, sessionId: session._id })

        await expect(
            viewingAs.mutation(api.usage_resets.redeemUsageReset, { grantId })
        ).rejects.toThrow("Banked Resets can't be used while viewing as this user")
        await customer.as.mutation(api.usage_resets.redeemUsageReset, { grantId })
    })

    it("won't revoke a per-user Banked Reset that was already used", async () => {
        const { operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        await spend(customer.id, 400_000)
        const { grantId } = await operator.as.mutation(api.usage_resets.grantUsageReset, {
            ...globalTicket,
            target: { kind: "user", authUserId: customer.id }
        })
        await customer.as.mutation(api.usage_resets.redeemUsageReset, { grantId })

        await expect(
            operator.as.mutation(api.usage_resets.revokeUsageReset, { grantId })
        ).rejects.toThrow("This Banked Reset was already used")
    })

    it("holds a Banked Reset back until the plan's share of the limit is used", async () => {
        const { operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        // 60% of the free plan's default $0.50 month.
        await spend(customer.id, 300_000)
        const { grantId } = await operator.as.mutation(
            api.usage_resets.grantUsageReset,
            globalTicket
        )

        expect(await customer.as.query(api.usage_resets.getMyUsageResetTickets, {})).toEqual([
            expect.objectContaining({ canRedeem: false, usableAtPercent: 70 })
        ])
        await expect(
            customer.as.mutation(api.usage_resets.redeemUsageReset, { grantId })
        ).rejects.toThrow("This Banked Reset is usable once you've used 70% of your limit")

        await spend(customer.id, 60_000)
        await customer.as.mutation(api.usage_resets.redeemUsageReset, { grantId })
    })

    it("leaves usage a reset forgave out of the deletion snapshot, carried usage included", async () => {
        const { t, operator, createUser, spend } = await setup()
        const customer = await createUser("customer@example.com")
        await spend(customer.id, 100_000)
        // Usage carried in from deleting an earlier account this period.
        await t.run(async (ctx) => {
            const [account, event] = await Promise.all([
                ctx.db
                    .query("prototypeCreditAccounts")
                    .withIndex("byUser", (q) => q.eq("userId", customer.id))
                    .first(),
                ctx.db.query("prototypeCreditEvents").first()
            ])
            if (!account || !event) throw new Error("Missing seeded usage")
            await ctx.db.patch(account._id, {
                carriedForPeriodKey: event.periodKey,
                carriedUsageMicrousd: 300_000
            })
        })
        vi.advanceTimersByTime(HOUR)
        await operator.as.mutation(api.usage_resets.grantUsageReset, {
            target: { kind: "user", authUserId: customer.id },
            window: "weekly",
            includesFiveHour: false,
            delivery: "instant",
            expiryMonths: null
        })
        vi.advanceTimersByTime(HOUR)
        await spend(customer.id, 50_000)

        const { getDeletionCreditSnapshot } = await import("../../convex/account_deletion")
        const snapshot = await getDeletionCreditSnapshot(
            // The snapshot only reads through runQuery, so that's all the action needs.
            {
                runQuery: (query: Parameters<typeof t.query>[0], args: Record<string, unknown>) =>
                    t.query(query, args)
            } as unknown as Parameters<typeof getDeletionCreditSnapshot>[0],
            customer.id,
            Date.now()
        )

        // $0.40 before the reset, a quarter of the $0.50 limit forgiven, then $0.05 after.
        expect(snapshot).toMatchObject({
            consumedUsageMicrousd: 325_000,
            carriedUsageMicrousd: 0,
            latestResetAt: expect.any(Number)
        })
    })
})
