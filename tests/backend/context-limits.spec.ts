import { afterEach, describe, expect, it } from "vitest"

import {
    DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS,
    getContextLimitViolation,
    resolveContextLimits
} from "../../convex/lib/context_limits"

describe("context limit policy", () => {
    const originalEnv = { ...process.env }

    afterEach(() => {
        process.env = { ...originalEnv }
    })

    it("caps cheap hosted models at the global hosted maximum", () => {
        const limits = resolveContextLimits({
            contextLength: 1_000_000,
            maxTokens: 8_000,
            inputUsdPer1MTokens: 0.1
        })

        expect(limits.hostedInputLimit).toBe(DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS)
    })

    it("derives smaller hosted limits for expensive models from the input cost budget", () => {
        const limits = resolveContextLimits({
            contextLength: 1_000_000,
            maxTokens: 8_000,
            inputUsdPer1MTokens: 10
        })

        expect(limits.hostedInputLimit).toBe(5_000)
    })

    it("uses a conservative fallback when pricing metadata is missing", () => {
        const limits = resolveContextLimits({
            contextLength: 1_000_000,
            maxTokens: 8_000
        })

        expect(limits.hostedInputLimit).toBe(32_000)
    })

    it("allows BYOK to bypass the hosted limit but not the model limit", () => {
        const limits = resolveContextLimits({
            contextLength: 100_000,
            maxTokens: 10_000,
            inputUsdPer1MTokens: 10
        })

        expect(
            getContextLimitViolation({
                estimatedTokens: limits.hostedInputLimit + 1,
                limits,
                providerSource: "openrouter",
                modelId: "model"
            })
        ).toBeNull()

        expect(
            getContextLimitViolation({
                estimatedTokens: limits.modelInputLimit + 1,
                limits,
                providerSource: "openrouter",
                modelId: "model"
            })
        ).toMatchObject({
            limitType: "model",
            canUseByok: false
        })
    })
})
