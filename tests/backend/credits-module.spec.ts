import { beforeEach, describe, expect, it, vi } from "vitest"

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
    consumeCreditForMessage,
    consumeReservedToolCall,
    getMyCreditSummary,
    recordCreditEventForMessage,
    releaseReservedCreditForMessage,
    reserveCreditForMessage,
    reserveToolCallBudget,
    setMyPrototypeCreditPlan
} from "../../convex/credits"
import {
    getAnchoredMonthlyCreditPeriodBounds,
    getCreditPeriodKeyFromBounds,
    getCurrentCreditPeriodKey
} from "../../convex/lib/credits"

const getMyCreditSummaryHandler = getMyCreditSummary as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const recordCreditEventForMessageHandler = recordCreditEventForMessage as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const consumeCreditForMessageHandler = consumeCreditForMessage as unknown as {
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
const reserveToolCallBudgetHandler = reserveToolCallBudget as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const consumeReservedToolCallHandler = consumeReservedToolCall as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const setMyPrototypeCreditPlanHandler = setMyPrototypeCreditPlan as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}

type CreditAccount = Record<string, unknown>
type CreditEvent = Record<string, unknown>
type UserAccess = Record<string, unknown>
type CreditReservation = Record<string, unknown>
type ToolReservation = Record<string, unknown>
type CreditsCtx = Parameters<typeof getMyCreditSummaryHandler.handler>[0]

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
            insert: vi.fn().mockResolvedValue("new-event-id")
        }
    }) as CreditsCtx

describe("credits module", () => {
    beforeEach(() => {
        getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" })
        Reflect.deleteProperty(process.env, "MONTHLY_CREDITS_FREE")
        Reflect.deleteProperty(process.env, "MONTHLY_CREDITS_PRO")
        Reflect.deleteProperty(process.env, "MONTHLY_PRO_CREDITS")
    })

    it("returns a resolved credit summary with defaults and usage totals", async () => {
        process.env.MONTHLY_CREDITS_PRO = "1200"
        process.env.MONTHLY_PRO_CREDITS = "25"

        const result = await getMyCreditSummaryHandler.handler(
            createCtx({
                account: {
                    userId: "user-1",
                    enabled: true,
                    plan: "pro",
                    monthlyBasicCredits: 1200,
                    monthlyProCredits: 25
                },
                events: [
                    { counted: true, bucket: "basic", units: 3 },
                    { counted: true, bucket: "pro", units: 2 },
                    { counted: false, bucket: "none", units: 0 }
                ],
                creditReservations: [{ active: true, counted: true, bucket: "pro", units: 1 }]
            }),
            {}
        )

        expect(result).toMatchObject({
            enabled: true,
            plan: "pro",
            basic: {
                limit: 1200,
                used: 3,
                remaining: 1197
            },
            pro: {
                limit: 25,
                used: 3,
                remaining: 22
            },
            requestCounts: {
                internal: 2,
                byok: 1,
                total: 3
            }
        })
    })

    it("uses configured env limits when account overrides are absent", async () => {
        process.env.MONTHLY_CREDITS_FREE = "200"

        const result = await getMyCreditSummaryHandler.handler(
            createCtx({
                account: {
                    userId: "user-1",
                    enabled: true,
                    plan: "free"
                }
            }),
            {}
        )

        expect(result).toMatchObject({
            enabled: true,
            plan: "free",
            basic: {
                limit: 200,
                used: 0,
                remaining: 200
            },
            pro: {
                limit: 0,
                used: 0,
                remaining: 0
            }
        })
    })

    it("prefers explicit account overrides over configured env limits", async () => {
        process.env.MONTHLY_CREDITS_FREE = "200"

        const result = await getMyCreditSummaryHandler.handler(
            createCtx({
                account: {
                    userId: "user-1",
                    enabled: true,
                    plan: "free",
                    monthlyBasicCredits: 20,
                    monthlyProCredits: 0
                }
            }),
            {}
        )

        expect(result).toMatchObject({
            basic: {
                limit: 20,
                used: 0,
                remaining: 20
            }
        })
    })

    it("does not duplicate credit events for the same user/message key", async () => {
        const existingEvent = { _id: "existing-event-id" }

        const result = await recordCreditEventForMessageHandler.handler(
            createCtx({
                existingEvent
            }),
            {
                userId: "user-1",
                threadId: "thread-1",
                messageId: "assistant-1",
                messageKey: "msg-key-1",
                modelId: "shared-text",
                providerSource: "internal",
                feature: "chat",
                bucket: "basic",
                units: 1,
                counted: true
            }
        )

        expect(result).toBe("existing-event-id")
    })

    it("patches an existing account without snapshotting configured limits", async () => {
        const ctx = createCtx({
            account: {
                _id: "account-id",
                userId: "user-1",
                enabled: true,
                plan: "free",
                monthlyBasicCredits: 20,
                monthlyProCredits: 0
            }
        })

        const result = await setMyPrototypeCreditPlanHandler.handler(ctx, {
            plan: "pro"
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "account-id",
            expect.objectContaining({
                userId: "user-1",
                enabled: true,
                plan: "pro",
                monthlyBasicCredits: 20,
                monthlyProCredits: 0
            })
        )
        expect(result).toMatchObject({
            userId: "user-1",
            plan: "pro"
        })
    })

    it("atomically blocks counted usage once the plan bucket is exhausted", async () => {
        const result = await consumeCreditForMessageHandler.handler(
            createCtx({
                account: {
                    userId: "user-1",
                    enabled: true,
                    plan: "free"
                },
                events: [{ counted: true, bucket: "basic", units: 20 }]
            }),
            {
                userId: "user-1",
                messageId: "assistant-1",
                messageKey: "assistant-1:model",
                modelId: "shared-text",
                providerSource: "internal",
                feature: "chat",
                bucket: "basic",
                units: 1,
                counted: true,
                requiredPlan: "free"
            }
        )

        expect(result).toMatchObject({
            allowed: false,
            reason: "quota",
            limit: 20,
            used: 20,
            remaining: 0
        })
    })

    it("allows bypass users to consume counted usage past the plan bucket limit", async () => {
        const ctx = createCtx({
            account: {
                userId: "user-1",
                enabled: true,
                plan: "free"
            },
            userAccess: {
                userId: "user-1",
                isStaff: true,
                bypassLimits: true
            },
            events: [{ counted: true, bucket: "basic", units: 20 }]
        })

        const result = await consumeCreditForMessageHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-1",
            messageKey: "assistant-1:model",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "chat",
            bucket: "basic",
            units: 1,
            counted: true,
            requiredPlan: "pro"
        })

        expect(result).toMatchObject({
            allowed: true,
            bypassed: true
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeCreditEvents",
            expect.objectContaining({
                userId: "user-1",
                messageKey: "assistant-1:model"
            })
        )
    })

    it("files a brand-new account's first counted event under the anchored period key", async () => {
        // Regression: previously a new account's first event used the calendar-month fallback key
        // ("2026-06") because the period was computed from the stripped resolved account (no
        // anchor). That orphaned the event from the anchored period the summary queries read, so
        // the first message never counted against quota.
        const fixedNow = Date.UTC(2026, 5, 23, 8, 48, 45, 602)
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow)

        try {
            const ctx = createCtx() // no account row => brand-new account

            const result = await consumeCreditForMessageHandler.handler(ctx, {
                userId: "user-1",
                messageId: "assistant-1",
                messageKey: "assistant-1:model",
                modelId: "shared-text",
                providerSource: "internal",
                feature: "chat",
                bucket: "basic",
                units: 1,
                counted: true,
                requiredPlan: "free"
            })

            expect(result).toMatchObject({ allowed: true, existing: false })

            // The account is created on demand with a period anchor...
            expect(ctx.db.insert).toHaveBeenCalledWith(
                "prototypeCreditAccounts",
                expect.objectContaining({ creditPeriodAnchorAt: fixedNow })
            )

            // ...and the first event must land under the anchored period (not "2026-06").
            const expectedPeriodKey = getCreditPeriodKeyFromBounds(
                getAnchoredMonthlyCreditPeriodBounds({
                    timestamp: fixedNow,
                    anchorTimestamp: fixedNow
                })
            )
            expect(expectedPeriodKey).not.toBe(getCurrentCreditPeriodKey(fixedNow))
            expect(ctx.db.insert).toHaveBeenCalledWith(
                "prototypeCreditEvents",
                expect.objectContaining({
                    messageKey: "assistant-1:model",
                    periodKey: expectedPeriodKey
                })
            )
        } finally {
            nowSpy.mockRestore()
        }
    })

    it("includes active reserved tool credits in the reported basic usage", async () => {
        const result = await getMyCreditSummaryHandler.handler(
            createCtx({
                account: {
                    userId: "user-1",
                    enabled: true,
                    plan: "free",
                    monthlyBasicCredits: 20,
                    monthlyProCredits: 0
                },
                events: [{ counted: true, bucket: "basic", units: 4 }],
                reservations: [
                    {
                        active: true,
                        reservedBasicCredits: 3,
                        consumedBasicCredits: 1
                    }
                ]
            }),
            {}
        )

        expect(result.basic).toMatchObject({
            used: 6,
            remaining: 14
        })
    })

    it("applies carried basic usage when reporting the matching credit period", async () => {
        const fixedNow = Date.UTC(2026, 5, 23, 8, 48, 45, 602)
        const periodKey = getCreditPeriodKeyFromBounds(
            getAnchoredMonthlyCreditPeriodBounds({
                timestamp: fixedNow,
                anchorTimestamp: fixedNow
            })
        )
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow)

        try {
            const result = await getMyCreditSummaryHandler.handler(
                createCtx({
                    account: {
                        userId: "user-1",
                        enabled: true,
                        plan: "free",
                        monthlyBasicCredits: 20,
                        monthlyProCredits: 0,
                        creditPeriodAnchorAt: fixedNow,
                        carriedForPeriodKey: periodKey,
                        carriedBasicUnits: 7
                    },
                    events: [{ counted: true, bucket: "basic", units: 4 }]
                }),
                {}
            )

            expect(result.basic).toMatchObject({
                used: 11,
                remaining: 9
            })
        } finally {
            nowSpy.mockRestore()
        }
    })

    it("uses carried usage when enforcing counted model quota", async () => {
        const fixedNow = Date.UTC(2026, 5, 23, 8, 48, 45, 602)
        const periodKey = getCreditPeriodKeyFromBounds(
            getAnchoredMonthlyCreditPeriodBounds({
                timestamp: fixedNow,
                anchorTimestamp: fixedNow
            })
        )
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow)

        try {
            const result = await consumeCreditForMessageHandler.handler(
                createCtx({
                    account: {
                        userId: "user-1",
                        enabled: true,
                        plan: "free",
                        monthlyBasicCredits: 20,
                        monthlyProCredits: 0,
                        creditPeriodAnchorAt: fixedNow,
                        carriedForPeriodKey: periodKey,
                        carriedBasicUnits: 20
                    }
                }),
                {
                    userId: "user-1",
                    messageId: "assistant-1",
                    messageKey: "assistant-1:model",
                    modelId: "shared-text",
                    providerSource: "internal",
                    feature: "chat",
                    bucket: "basic",
                    units: 1,
                    counted: true,
                    requiredPlan: "free"
                }
            )

            expect(result).toMatchObject({
                allowed: false,
                reason: "quota",
                used: 20,
                remaining: 0
            })
        } finally {
            nowSpy.mockRestore()
        }
    })

    it("includes active reserved model credits in the reported usage", async () => {
        const result = await getMyCreditSummaryHandler.handler(
            createCtx({
                account: {
                    userId: "user-1",
                    enabled: true,
                    plan: "pro",
                    monthlyBasicCredits: 20,
                    monthlyProCredits: 5
                },
                events: [{ counted: true, bucket: "pro", units: 1 }],
                creditReservations: [{ active: true, counted: true, bucket: "pro", units: 2 }]
            }),
            {}
        )

        expect(result.pro).toMatchObject({
            used: 3,
            remaining: 2
        })
    })

    it("reserves and later commits a counted model charge without billing early", async () => {
        const ctx = createCtx({
            account: {
                userId: "user-1",
                enabled: true,
                plan: "free",
                monthlyBasicCredits: 20,
                monthlyProCredits: 0
            }
        })

        const reserveResult = await reserveCreditForMessageHandler.handler(ctx, {
            userId: "user-1",
            messageId: "assistant-1",
            messageKey: "assistant-1:model",
            modelId: "shared-text",
            providerSource: "internal",
            feature: "chat",
            bucket: "basic",
            units: 1,
            counted: true,
            requiredPlan: "free"
        })

        expect(reserveResult).toMatchObject({
            allowed: true,
            committed: false
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeCreditReservations",
            expect.objectContaining({
                userId: "user-1",
                messageKey: "assistant-1:model",
                bucket: "basic"
            })
        )

        const commitCtx = createCtx({
            creditReservations: [
                {
                    _id: "reservation-1",
                    userId: "user-1",
                    messageId: "assistant-1",
                    messageKey: "assistant-1:model",
                    modelId: "shared-text",
                    providerSource: "internal",
                    feature: "chat",
                    bucket: "basic",
                    units: 1,
                    counted: true,
                    periodKey: "2026-06",
                    active: true
                }
            ]
        })

        const commitResult = await commitReservedCreditForMessageHandler.handler(commitCtx, {
            userId: "user-1",
            messageKey: "assistant-1:model",
            threadId: "thread-1",
            messageId: "assistant-original"
        })

        expect(commitResult).toMatchObject({
            committed: true,
            existing: false
        })
        expect(commitCtx.db.insert).toHaveBeenCalledWith(
            "prototypeCreditEvents",
            expect.objectContaining({
                userId: "user-1",
                threadId: "thread-1",
                messageId: "assistant-original",
                messageKey: "assistant-1:model",
                bucket: "basic"
            })
        )
        expect(commitCtx.db.patch).toHaveBeenCalledWith(
            "reservation-1",
            expect.objectContaining({
                active: false
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

    it("reserves tool-call budget without enforcing limits for bypass users", async () => {
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
            reservedBasicCredits: 5
        })

        expect(result).toMatchObject({
            allowed: true,
            bypassed: true,
            reservedCalls: 5,
            reservedBasicCredits: 0
        })
        expect(ctx.db.insert).not.toHaveBeenCalledWith(
            "prototypeToolCallReservations",
            expect.anything()
        )
    })

    it("records tool attempts for bypass users without requiring a reservation row", async () => {
        const ctx = createCtx({
            userAccess: {
                userId: "user-1",
                isStaff: true,
                bypassLimits: true
            }
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
            bucket: "basic",
            units: 1,
            counted: true
        })

        expect(result).toMatchObject({
            allowed: true,
            bypassed: true
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "prototypeCreditEvents",
            expect.objectContaining({
                userId: "user-1",
                messageKey: "assistant-1:tool:call-1",
                feature: "tool"
            })
        )
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
            reservedBasicCredits: 0
        })

        expect(result).toMatchObject({
            allowed: true,
            existing: false,
            reservedCalls: 3,
            reservedBasicCredits: 0
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
})
