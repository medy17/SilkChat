import { describe, expect, it } from "vitest"

import {
    getAnchoredMonthlyCreditPeriodBounds,
    getConfiguredCreditLimits,
    getCreditPeriodBounds,
    getCreditPeriodKeyFromBounds,
    getCurrentCreditPeriodKey,
    resolvePrototypeCreditCharge,
    resolvePrototypeToolCreditCharge,
    resolveRequiredPlanForModelAccess,
    resolveRequiredPlanForPrototypeModel
} from "../../convex/lib/credits"

describe("credits", () => {
    it("uses configured monthly limits when environment values are valid", () => {
        process.env.MONTHLY_CREDITS_FREE = "42"
        process.env.MONTHLY_CREDITS_PRO = "900"
        process.env.MONTHLY_PRO_CREDITS = "15"

        expect(getConfiguredCreditLimits("free")).toEqual({ basic: 42, pro: 0 })
        expect(getConfiguredCreditLimits("pro")).toEqual({ basic: 900, pro: 15 })
    })

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

    it("charges model usage independently from tool availability", () => {
        expect(
            resolvePrototypeCreditCharge({
                providerSource: "internal",
                modelMode: "text",
                enabledTools: [],
                reasoningEffort: "high",
                prototypeCreditTier: "basic",
                prototypeCreditTierWithReasoning: "pro"
            })
        ).toEqual({
            bucket: "pro",
            feature: "chat",
            counted: true,
            units: 1
        })

        expect(
            resolvePrototypeCreditCharge({
                providerSource: "internal",
                modelMode: "text",
                enabledTools: ["web_search"],
                reasoningEffort: "off",
                prototypeCreditTier: "basic"
            })
        ).toEqual({
            bucket: "basic",
            feature: "chat",
            counted: true,
            units: 1
        })
    })

    it("charges deployment-funded tool calls as basic credits", () => {
        expect(
            resolvePrototypeToolCreditCharge({
                fundingSource: "deployment"
            })
        ).toEqual({
            providerSource: "internal",
            bucket: "basic",
            feature: "tool",
            counted: true,
            units: 1
        })

        expect(
            resolvePrototypeToolCreditCharge({
                fundingSource: "byok"
            })
        ).toEqual({
            providerSource: "byok",
            bucket: "none",
            feature: "tool",
            counted: false,
            units: 0
        })
    })

    it("does not count BYOK requests against prototype credits", () => {
        expect(
            resolvePrototypeCreditCharge({
                providerSource: "byok",
                modelMode: "image",
                enabledTools: [],
                reasoningEffort: "off"
            })
        ).toEqual({
            bucket: "none",
            feature: "image",
            counted: false,
            units: 0
        })
    })

    it("resolves required plans from prototype model tiers", () => {
        expect(
            resolveRequiredPlanForPrototypeModel({
                modelMode: "text",
                reasoningEffort: "off",
                prototypeCreditTier: "basic"
            })
        ).toBe("free")

        expect(
            resolveRequiredPlanForPrototypeModel({
                modelMode: "image",
                reasoningEffort: "off"
            })
        ).toBe("pro")

        expect(
            resolveRequiredPlanForPrototypeModel({
                modelMode: "text",
                reasoningEffort: "high",
                prototypeCreditTier: "basic",
                prototypeCreditTierWithReasoning: "pro"
            })
        ).toBe("pro")
    })

    it("resolves picker access separately from credit buckets", () => {
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
