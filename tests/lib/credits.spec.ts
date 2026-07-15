import { describe, expect, it } from "vitest"

import {
    getAnchoredMonthlyCreditPeriodBounds,
    getCreditPeriodBounds,
    getCreditPeriodKeyFromBounds,
    getCurrentCreditPeriodKey,
    resolveRequiredPlanForModelAccess
} from "../../convex/lib/credits"

describe("credits", () => {
    it("calculates UTC credit period keys and bounds", () => {
        const timestamp = Date.UTC(2026, 2, 31, 23, 59, 59, 999)

        expect(getCurrentCreditPeriodKey(timestamp)).toBe("2026-03")
        expect(getCreditPeriodBounds(timestamp)).toEqual({
            startsAt: Date.UTC(2026, 2, 1, 0, 0, 0, 0),
            endsAt: Date.UTC(2026, 3, 1, 0, 0, 0, 0)
        })
    })

    it("calculates rolling monthly credit periods from an account or billing anchor", () => {
        const bounds = getAnchoredMonthlyCreditPeriodBounds({
            anchorTimestamp: Date.parse("2026-06-14T09:54:18.000Z"),
            timestamp: Date.parse("2026-07-01T00:00:00.000Z")
        })

        expect(bounds).toEqual({
            startsAt: Date.parse("2026-06-14T09:54:18.000Z"),
            endsAt: Date.parse("2026-07-14T09:54:18.000Z")
        })
        expect(getCreditPeriodKeyFromBounds(bounds)).toBe(
            "2026-06-14T09:54:18.000Z/2026-07-14T09:54:18.000Z"
        )
    })

    it("clamps anchored periods for short months", () => {
        expect(
            getAnchoredMonthlyCreditPeriodBounds({
                anchorTimestamp: Date.parse("2026-01-31T12:00:00.000Z"),
                timestamp: Date.parse("2026-02-28T12:30:00.000Z")
            })
        ).toEqual({
            startsAt: Date.parse("2026-02-28T12:00:00.000Z"),
            endsAt: Date.parse("2026-03-28T12:00:00.000Z")
        })
    })

    it("resolves picker access from plan availability metadata", () => {
        expect(
            resolveRequiredPlanForModelAccess({
                reasoningEffort: "off",
                availableToPickFor: "pro"
            })
        ).toBe("pro")

        expect(
            resolveRequiredPlanForModelAccess({
                reasoningEffort: "off",
                availableToPickFor: "free",
                availableToPickForReasoningEfforts: {
                    low: "pro",
                    medium: "pro",
                    high: "pro"
                }
            })
        ).toBe("free")

        expect(
            resolveRequiredPlanForModelAccess({
                reasoningEffort: "medium",
                availableToPickFor: "free",
                availableToPickForReasoningEfforts: {
                    low: "pro",
                    medium: "pro",
                    high: "pro"
                }
            })
        ).toBe("pro")
    })
})
