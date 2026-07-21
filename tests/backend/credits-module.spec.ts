import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getUserIdentityMock } = vi.hoisted(() => ({
    getUserIdentityMock: vi.fn()
}))

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return {
        v: new Proxy(
            {},
            {
                get: () => passthrough
            }
        )
    }
})

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    mutation: (config: unknown) => config,
    query: (config: unknown) => config
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

import {
    commitReservedCreditForMessage,
    consumeReservedToolCall,
    getMyCreditUsageSummary,
    getMyDevCreditState,
    reconcileSettledToolUsageCost,
    reconcileSettledUsageCost,
    releaseReservedCreditForMessage,
    reserveCreditForMessage,
    reserveToolCallBudget,
    setMyDevCreditState
} from "../../convex/credits"
import {
    getAnchoredMonthlyCreditPeriodBounds,
    getCreditPeriodKeyFromBounds
} from "../../convex/lib/credits"

const getMyCreditUsageSummaryHandler = getMyCreditUsageSummary as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const reserveCreditForMessageHandler = reserveCreditForMessage as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const commitReservedCreditForMessageHandler = commitReservedCreditForMessage as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const releaseReservedCreditForMessageHandler = releaseReservedCreditForMessage as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const reconcileSettledUsageCostHandler = reconcileSettledUsageCost as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const reconcileSettledToolUsageCostHandler = reconcileSettledToolUsageCost as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const reserveToolCallBudgetHandler = reserveToolCallBudget as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const consumeReservedToolCallHandler = consumeReservedToolCall as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const setMyDevCreditStateHandler = setMyDevCreditState as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const getMyDevCreditStateHandler = getMyDevCreditState as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}

type CreditAccount = Record<string, unknown>
type CreditEvent = Record<string, unknown>
type UserAccess = Record<string, unknown>
type CreditReservation = Record<string, unknown>
type ToolReservation = Record<string, unknown>
type CreditsCtx = Parameters<typeof getMyCreditUsageSummaryHandler.handler>[0]

const createCtx = (options?: {
    account?: CreditAccount
    events?: CreditEvent[]
    existingEvent?: CreditEvent
    userAccess?: UserAccess
    creditReservations?: CreditReservation[]
    reservations?: ToolReservation[]
}) =>
    ({
        auth: {},
        db: {
            query: vi.fn().mockImplementation((table: string) => ({
                withIndex: vi.fn().mockReturnValue({
                    first: vi
                        .fn()
                        .mockResolvedValue(
                            table === "prototypeCreditAccounts"
                                ? (options?.account ?? null)
                                : table === "prototypeCreditEvents"
                                  ? (options?.existingEvent ?? null)
                                  : table === "userAccess"
                                    ? (options?.userAccess ?? null)
                                    : table === "prototypeCreditReservations"
                                      ? ((options?.creditReservations?.[0] as
                                            | CreditReservation
                                            | undefined) ?? null)
                                      : table === "prototypeToolCallReservations"
                                        ? ((options?.reservations?.[0] as
                                              | ToolReservation
                                              | undefined) ?? null)
                                        : null
                        ),
                    collect: vi
                        .fn()
                        .mockResolvedValue(
                            table === "prototypeCreditEvents"
                                ? (options?.events ?? [])
                                : table === "prototypeCreditReservations"
                                  ? (options?.creditReservations ?? [])
                                  : table === "prototypeToolCallReservations"
                                    ? (options?.reservations ?? [])
                                    : []
                        )
                })
            })),
            patch: vi.fn(),
            delete: vi.fn(),
            insert: vi.fn().mockResolvedValue("new-event-id")
        }
    }) as CreditsCtx

describe("credits module", () => {
    beforeEach(() => {
        getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" })
        Reflect.deleteProperty(process.env, "HOSTED_USAGE_5H_USD_FREE")
        Reflect.deleteProperty(process.env, "HOSTED_USAGE_MONTHLY_USD_FREE")
        Reflect.deleteProperty(process.env, "HOSTED_USAGE_5H_USD_PRO")
        Reflect.deleteProperty(process.env, "HOSTED_USAGE_MONTHLY_USD_PRO")
        // Dev credit lab controls are gated behind an explicit opt-in env var, which is
        // set only on non-production deployments (NODE_ENV is always "production" inside
        // Convex, so it can't gate this).
        process.env.DEV_CREDIT_LAB_ENABLED = "1"
    })

    afterEach(() => {
        Reflect.deleteProperty(process.env, "DEV_CREDIT_LAB_ENABLED")
    })

    it("denies dev credit lab controls unless explicitly enabled", async () => {
        Reflect.deleteProperty(process.env, "DEV_CREDIT_LAB_ENABLED")
        const ctx = createCtx({})

        await expect(getMyDevCreditStateHandler.handler(ctx, {})).rejects.toThrow(
            "unavailable in production"
        )
        await expect(setMyDevCreditStateHandler.handler(ctx, {})).rejects.toThrow(
            "unavailable in production"
        )
    })

    it("emulates hosted usage windows through the dev credit lab", async () => {
        process.env.HOSTED_USAGE_5H_USD_FREE = "0.1"
        process.env.HOSTED_USAGE_MONTHLY_USD_FREE = "0.5"
        const fixedNow = Date.UTC(2026, 5, 23, 8, 48, 45, 602)
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow)
        const periodKey = getCreditPeriodKeyFromBounds(
            getAnchoredMonthlyCreditPeriodBounds({
                timestamp: fixedNow,
                anchorTimestamp: fixedNow
            })
        )
        const ctx = createCtx({
            events: [
                {
                    _id: "old-dev-usage-event",
                    userId: "user-1",
                    periodKey,
                    messageKey: "dev-credit-lab:usage:old",
                    counted: true,
                    bucket: "none",
                    units: 0
                }
            ]
        })

        try {
            await setMyDevCreditStateHandler.handler(ctx, {
                plan: "free",
                usageScenario: "usage_5h_exhausted"
            })

            expect(ctx.db.delete).toHaveBeenCalledWith("old-dev-usage-event")
            expect(ctx.db.insert).toHaveBeenCalledWith(
                "prototypeCreditEvents",
                expect.objectContaining({
                    messageKey: "dev-credit-lab:usage-window:boundary",
                    counted: false,
                    bucket: "none",
                    units: 0,
                    createdAt: fixedNow
                })
            )
            expect(ctx.db.insert).toHaveBeenCalledWith(
                "prototypeCreditEvents",
                expect.objectContaining({
                    messageKey: "dev-credit-lab:usage:5h:exhausted",
                    accountingKind: "usage",
                    reservedMicrousd: 100_000,
                    settledMicrousd: 100_000,
                    bucket: "none",
                    units: 0,
                    createdAt: fixedNow
                })
            )
        } finally {
            nowSpy.mockRestore()
        }
    })

    it("resets the dev-emulated five-hour hosted usage window without inserting usage", async () => {
        const fixedNow = Date.UTC(2026, 5, 23, 8, 48, 45, 602)
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow)
        const periodKey = getCreditPeriodKeyFromBounds(
            getAnchoredMonthlyCreditPeriodBounds({
                timestamp: fixedNow,
                anchorTimestamp: fixedNow
            })
        )
        const ctx = createCtx({
            events: [
                {
                    _id: "old-dev-usage-event",
                    userId: "user-1",
                    periodKey,
                    messageKey: "dev-credit-lab:usage:5h:exhausted",
                    counted: true,
                    bucket: "none",
                    units: 0
                }
            ]
        })

        try {
            await setMyDevCreditStateHandler.handler(ctx, {
                plan: "free",
                usageScenario: "usage_5h_reset"
            })

            expect(ctx.db.delete).toHaveBeenCalledWith("old-dev-usage-event")
            expect(ctx.db.insert).toHaveBeenCalledWith(
                "prototypeCreditEvents",
                expect.objectContaining({
                    messageKey: "dev-credit-lab:usage-window:boundary",
                    counted: false,
                    createdAt: fixedNow
                })
            )
            expect(ctx.db.insert).not.toHaveBeenCalledWith(
                "prototypeCreditEvents",
                expect.objectContaining({
                    accountingKind: "usage"
                })
            )
        } finally {
            nowSpy.mockRestore()
        }
    })

    it("enforces the active metered hosted-usage cap and settles the reported cost", async () => {
        process.env.HOSTED_USAGE_5H_USD_PRO = "1"
        process.env.HOSTED_USAGE_MONTHLY_USD_PRO = "18"
        const ctx = createCtx({
            account: {
                userId: "user-1",
                enabled: true,
                plan: "pro"
            },
            events: [
                {
                    accountingKind: "usage",
                    settledMicrousd: 900_000,
                    createdAt: Date.now() - 60_000
                }
            ]
        })

        const blocked = await reserveCreditForMessageHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-usage",
            messageKey: "assistant-usage:model",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "chat",
            counted: true,
            reservedMicrousd: 200_000,
            pricingSource: "openrouter_estimate",
            requiredPlan: "pro"
        })

        expect(blocked).toMatchObject({
            allowed: false,
            reason: "usage",
            window: "five_hour",
            limitUsd: 1,
            remainingUsd: 0.1
        })

        const commitCtx = createCtx({
            creditReservations: [
                {
                    _id: "usage-reservation",
                    userId: "user-1",
                    messageId: "assistant-usage",
                    messageKey: "assistant-usage:model",
                    modelId: "shared-text",
                    providerSource: "internal",
                    feature: "chat",
                    bucket: "pro",
                    units: 1,
                    counted: true,
                    accountingKind: "usage",
                    reservedMicrousd: 200_000,
                    pricingSource: "openrouter_estimate",
                    periodKey: "2026-07",
                    active: true,
                    createdAt: 1783699980000
                }
            ]
        })

        await commitReservedCreditForMessageHandler.handler(commitCtx, {
            userId: "user-1",
            messageKey: "assistant-usage:model",
            settledMicrousd: 125_000,
            pricingSource: "openrouter_reported"
        })

        expect(commitCtx.db.insert).toHaveBeenCalledWith(
            "prototypeCreditEvents",
            expect.objectContaining({
                accountingKind: "usage",
                reservedMicrousd: 200_000,
                settledMicrousd: 125_000,
                pricingSource: "openrouter_reported",
                createdAt: 1783699980000
            })
        )
    })

    it("starts a fresh five-hour window after the previous metered window expires", async () => {
        process.env.HOSTED_USAGE_5H_USD_FREE = "0.1"
        process.env.HOSTED_USAGE_MONTHLY_USD_FREE = "1"
        const now = Date.now()
        const ctx = createCtx({
            account: {
                userId: "user-1",
                enabled: true,
                plan: "free"
            },
            events: [
                {
                    accountingKind: "usage",
                    settledMicrousd: 95_000,
                    counted: true,
                    createdAt: now - 301 * 60 * 1000
                },
                {
                    accountingKind: "usage",
                    settledMicrousd: 5_000,
                    counted: true,
                    createdAt: now - 2 * 60 * 1000
                }
            ]
        })

        const result = await reserveCreditForMessageHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-usage",
            messageKey: "assistant-usage:model",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "chat",
            counted: true,
            reservedMicrousd: 100_000,
            pricingSource: "openrouter_estimate"
        })

        expect(result).toMatchObject({
            allowed: true,
            existing: false
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeCreditReservations",
            expect.objectContaining({
                accountingKind: "usage",
                reservedMicrousd: 100_000
            })
        )
    })

    it("lets a dev boundary end the active five-hour window without deleting real usage", async () => {
        process.env.HOSTED_USAGE_5H_USD_FREE = "0.1"
        process.env.HOSTED_USAGE_MONTHLY_USD_FREE = "1"
        const now = Date.now()

        const result = await getMyCreditUsageSummaryHandler.handler(
            createCtx({
                account: {
                    userId: "user-1",
                    enabled: true,
                    plan: "free"
                },
                events: [
                    {
                        accountingKind: "usage",
                        settledMicrousd: 80_000,
                        counted: true,
                        bucket: "none",
                        units: 0,
                        messageKey: "real-usage",
                        createdAt: now - 50 * 60 * 1000
                    },
                    {
                        counted: false,
                        bucket: "none",
                        units: 0,
                        messageKey: "dev-credit-lab:usage-window:boundary",
                        createdAt: now
                    }
                ]
            }),
            {}
        )

        expect(result.usageMetering.fiveHour).toMatchObject({
            usedUsd: 0,
            remainingUsd: 0.1,
            recoversAt: null
        })
        expect(result.usageMetering.monthly).toMatchObject({
            usedUsd: 0.08,
            remainingUsd: 0.92
        })
    })

    it("reconciles a settled fal reservation with the billing event cost", async () => {
        const ctx = createCtx({
            existingEvent: {
                _id: "usage-event",
                accountingKind: "usage",
                settledMicrousd: 250_000
            }
        })

        const result = await reconcileSettledUsageCostHandler.handler(ctx, {
            userId: "user-1",
            messageKey: "image-1",
            providerRequestId: "fal-request-1",
            settledMicrousd: 87_500,
            pricingSource: "fal_reported"
        })

        expect(result).toEqual({ reconciled: true, settledMicrousd: 87_500 })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "usage-event",
            expect.objectContaining({
                settledMicrousd: 87_500,
                providerRequestId: "fal-request-1",
                pricingSource: "fal_reported"
            })
        )
    })

    it("releases a reserved model charge without committing a credit event", async () => {
        const ctx = createCtx({
            creditReservations: [
                {
                    _id: "reservation-1",
                    userId: "user-1",
                    messageKey: "assistant-1:model",
                    active: true
                }
            ]
        })

        await releaseReservedCreditForMessageHandler.handler(ctx, {
            userId: "user-1",
            messageKey: "assistant-1:model"
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "reservation-1",
            expect.objectContaining({
                active: false
            })
        )
        expect(ctx.db.insert).not.toHaveBeenCalledWith("prototypeCreditEvents", expect.anything())
    })

    it("keeps the tool-call cap active when only usage limits are bypassed", async () => {
        const ctx = createCtx({
            userAccess: {
                userId: "user-1",
                isStaff: true,
                bypassLimits: true
            }
        })

        const result = await reserveToolCallBudgetHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-1",
            messageKey: "assistant-1:tool-budget",
            reservedCalls: 5,
            reservedMicrousd: 20_000
        })

        expect(result).toMatchObject({
            allowed: true,
            bypassed: false,
            reservedCalls: 5
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeToolCallReservations",
            expect.objectContaining({
                reservedCalls: 5,
                bypassCallLimit: false,
                reservedMicrousd: 0
            })
        )
    })

    it("blocks usage-bypass users when their tool-call reservation is exhausted", async () => {
        const ctx = createCtx({
            userAccess: {
                userId: "user-1",
                isStaff: true,
                bypassLimits: true
            },
            reservations: [
                {
                    _id: "tool-reservation-1",
                    reservedCalls: 1,
                    consumedCalls: 1,
                    active: true
                }
            ]
        })

        const result = await consumeReservedToolCallHandler.handler(ctx, {
            userId: "user-1",
            reservationMessageKey: "assistant-1:tool-budget",
            messageId: "assistant-1",
            messageKey: "assistant-1:tool:call-1",
            toolCallId: "call-1",
            toolName: "web_search",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "tool",
            counted: true
        })

        expect(result).toMatchObject({
            allowed: false,
            reason: "budget_exhausted",
            remainingCalls: 0
        })
        expect(ctx.db.insert).not.toHaveBeenCalledWith("prototypeCreditEvents", expect.anything())
    })

    it("allows an explicit tool-call-limit bypass independently", async () => {
        const ctx = createCtx({
            userAccess: {
                userId: "user-1",
                isStaff: true,
                bypassLimits: true,
                bypassToolCallLimits: true
            },
            reservations: [
                {
                    _id: "tool-reservation-1",
                    reservedCalls: 1,
                    consumedCalls: 1,
                    consumedMicrousd: 0,
                    periodKey: "2026-07",
                    bypassCallLimit: true,
                    active: true
                }
            ]
        })

        const result = await consumeReservedToolCallHandler.handler(ctx, {
            userId: "user-1",
            reservationMessageKey: "assistant-1:tool-budget",
            messageId: "assistant-1",
            messageKey: "assistant-1:tool:call-2",
            toolCallId: "call-2",
            toolName: "web_search",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "tool",
            counted: true,
            chargedMicrousd: 5_000
        })

        expect(result).toMatchObject({
            allowed: true,
            bypassed: true,
            remainingCalls: null
        })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "tool-reservation-1",
            expect.objectContaining({
                consumedCalls: 2,
                consumedMicrousd: 0
            })
        )
    })

    it("persists an explicit tool-call-limit bypass on the turn reservation", async () => {
        const ctx = createCtx({
            userAccess: {
                userId: "user-1",
                isStaff: true,
                bypassLimits: false,
                bypassToolCallLimits: true
            }
        })

        const result = await reserveToolCallBudgetHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-1",
            messageKey: "assistant-1:tool-budget",
            reservedCalls: 3,
            reservedMicrousd: 0
        })

        expect(result).toMatchObject({
            allowed: true,
            bypassed: true,
            reservedCalls: 3
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeToolCallReservations",
            expect.objectContaining({
                bypassCallLimit: true
            })
        )
    })

    it("still enforces hosted usage limits after the bypassed call reserve is consumed", async () => {
        process.env.HOSTED_USAGE_5H_USD_FREE = "0.001"
        const ctx = createCtx({
            userAccess: {
                userId: "user-1",
                isStaff: true,
                bypassLimits: false,
                bypassToolCallLimits: true
            },
            reservations: [
                {
                    _id: "tool-reservation-1",
                    reservedCalls: 1,
                    consumedCalls: 1,
                    reservedMicrousd: 5_000,
                    consumedMicrousd: 5_000,
                    periodKey: "2026-07",
                    bypassCallLimit: true,
                    active: true,
                    createdAt: Date.now()
                }
            ]
        })

        const result = await consumeReservedToolCallHandler.handler(ctx, {
            userId: "user-1",
            reservationMessageKey: "assistant-1:tool-budget",
            messageId: "assistant-1",
            messageKey: "assistant-1:tool:call-2",
            toolCallId: "call-2",
            toolName: "web_search",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "tool",
            counted: true,
            chargedMicrousd: 5_000
        })

        expect(result).toMatchObject({
            allowed: false,
            reason: "usage",
            window: "five_hour"
        })
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("does not reuse finalized tool-call reservations for a new request attempt", async () => {
        const ctx = createCtx({
            reservations: [
                {
                    _id: "reservation-1",
                    userId: "user-1",
                    messageId: "assistant-old",
                    messageKey: "assistant-old:tool-budget",
                    reservedCalls: 1,
                    consumedCalls: 1,
                    reservedBasicCredits: 1,
                    consumedBasicCredits: 1,
                    active: false
                }
            ]
        })

        const result = await reserveToolCallBudgetHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-new",
            messageKey: "assistant-new:tool-budget",
            reservedCalls: 3,
            reservedMicrousd: 0
        })

        expect(result).toMatchObject({
            allowed: true,
            existing: false,
            reservedCalls: 3
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeToolCallReservations",
            expect.objectContaining({
                userId: "user-1",
                messageKey: "assistant-new:tool-budget",
                reservedCalls: 3,
                active: true
            })
        )
    })

    it("blocks the tool-call budget when the metered reserve exceeds the active window", async () => {
        process.env.HOSTED_USAGE_5H_USD_FREE = "0.1"
        const ctx = createCtx({
            account: {
                userId: "user-1",
                enabled: true,
                plan: "free"
            },
            events: [
                {
                    accountingKind: "usage",
                    settledMicrousd: 95_000,
                    counted: true,
                    createdAt: Date.now() - 60_000
                }
            ]
        })

        const result = await reserveToolCallBudgetHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-1",
            messageKey: "assistant-1:tool-budget",
            reservedCalls: 3,
            reservedMicrousd: 12_000
        })

        expect(result).toMatchObject({
            allowed: false,
            reason: "usage",
            window: "five_hour",
            limitUsd: 0.1,
            remainingUsd: 0.005
        })
        expect(ctx.db.insert).not.toHaveBeenCalledWith(
            "prototypeToolCallReservations",
            expect.anything()
        )
    })

    it("settles a consumed tool call at the flat metered rate", async () => {
        const ctx = createCtx({
            reservations: [
                {
                    _id: "tool-reservation-1",
                    userId: "user-1",
                    messageId: "assistant-1",
                    messageKey: "assistant-1:tool-budget",
                    reservedCalls: 3,
                    consumedCalls: 0,
                    reservedBasicCredits: 0,
                    consumedBasicCredits: 0,
                    reservedMicrousd: 12_000,
                    consumedMicrousd: 0,
                    periodKey: "2026-07",
                    active: true
                }
            ]
        })

        const result = await consumeReservedToolCallHandler.handler(ctx, {
            userId: "user-1",
            reservationMessageKey: "assistant-1:tool-budget",
            messageId: "assistant-1",
            messageKey: "assistant-1:tool:call-1",
            toolCallId: "call-1",
            toolName: "web_search",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "tool",
            counted: true,
            chargedMicrousd: 4_000
        })

        expect(result).toMatchObject({
            allowed: true,
            remainingCalls: 2
        })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "tool-reservation-1",
            expect.objectContaining({
                consumedCalls: 1,
                consumedMicrousd: 4_000
            })
        )
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeCreditEvents",
            expect.objectContaining({
                accountingKind: "usage",
                reservedMicrousd: 4_000,
                settledMicrousd: 4_000,
                pricingSource: "tool_flat"
            })
        )
    })

    it("reconciles a provisional code-execution charge to measured sandbox usage", async () => {
        const ctx = createCtx({
            existingEvent: {
                _id: "tool-event-1",
                accountingKind: "usage",
                settledMicrousd: 5_000,
                pricingSource: "tool_flat"
            }
        })

        const result = await reconcileSettledToolUsageCostHandler.handler(ctx, {
            userId: "user-1",
            messageKey: "assistant-1:tool:call-1",
            settledMicrousd: 1_234,
            pricingSource: "sandbox_reported"
        })

        expect(result).toEqual({ reconciled: true, settledMicrousd: 1_234 })
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "tool-event-1",
            expect.objectContaining({
                settledMicrousd: 1_234,
                pricingSource: "sandbox_reported"
            })
        )
    })
})
