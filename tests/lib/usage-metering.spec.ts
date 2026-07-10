import { afterEach, describe, expect, it } from "vitest"
import {
    estimateOpenRouterReservationMicrousd,
    getConfiguredHostedUsageLimits,
    getConfiguredToolUsageMicrousd,
    resolveFalBillingEventMicrousd,
    resolveFalEstimateMicrousd,
    usdToMicrousd
} from "../../convex/lib/usage_metering"

const originalEnv = { ...process.env }

afterEach(() => {
    process.env = { ...originalEnv }
})

describe("hosted usage metering", () => {
    it("uses configurable five-hour and monthly plan limits", () => {
        process.env.HOSTED_USAGE_5H_USD_PRO = "1.25"
        process.env.HOSTED_USAGE_MONTHLY_USD_PRO = "21"

        expect(getConfiguredHostedUsageLimits("pro")).toEqual({
            fiveHourMicrousd: 1_250_000,
            monthlyMicrousd: 21_000_000
        })
    })

    it("prices deployment-funded tool calls at the flat upstream rate", () => {
        expect(getConfiguredToolUsageMicrousd("web_search")).toBe(4_000)

        process.env.TOOL_USAGE_USD_WEB_SEARCH = "0.01"
        expect(getConfiguredToolUsageMicrousd("web_search")).toBe(10_000)

        expect(getConfiguredToolUsageMicrousd("unknown_tool")).toBe(0)
    })

    it("reserves prompt and bounded output cost using model prices", () => {
        process.env.HOSTED_USAGE_OUTPUT_RESERVE_TOKENS = "4000"

        expect(
            estimateOpenRouterReservationMicrousd({
                estimatedInputTokens: 10_000,
                maxOutputTokens: 16_000,
                inputUsdPer1MTokens: 3,
                outputUsdPer1MTokens: 15
            })
        ).toBe(usdToMicrousd(0.09))
    })

    it("converts the matching fal billing event from nano USD to micro USD", () => {
        expect(
            resolveFalBillingEventMicrousd(
                {
                    billing_events: [
                        { request_id: "other", cost_estimate_nano_usd: 999_000_000 },
                        { request_id: "request-1", cost_estimate_nano_usd: 125_500_000 }
                    ]
                },
                "request-1"
            )
        ).toBe(125_500)
        expect(resolveFalBillingEventMicrousd({ billing_events: [] }, "missing")).toBeUndefined()
    })

    it("converts fal pricing estimates to micro USD", () => {
        expect(resolveFalEstimateMicrousd({ total_cost: 0.0875, currency: "USD" })).toBe(87_500)
        expect(resolveFalEstimateMicrousd({ total_cost: 0, currency: "USD" })).toBeUndefined()
        expect(resolveFalEstimateMicrousd({ total_cost: 1, currency: "EUR" })).toBeUndefined()
    })
})
