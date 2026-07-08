import { afterEach, describe, expect, it } from "vitest"

import {
    DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD,
    DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS,
    type ModelSuggestionCandidate,
    computeSuggestedModels,
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

        expect(limits.hostedInputLimit).toBe(
            (DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD * 1_000_000) / 10
        )
    })

    it("uses a conservative fallback when pricing metadata is missing", () => {
        const limits = resolveContextLimits({
            contextLength: 1_000_000,
            maxTokens: 8_000
        })

        expect(limits.hostedInputLimit).toBe(32_000)
    })

    it("applies a dev hosted-limit override, staying clamped to the model limit", () => {
        const model = { contextLength: 1_000_000, maxTokens: 8_000, inputUsdPer1MTokens: 10 }

        // Raise the hosted limit well above its price-derived value.
        const raised = resolveContextLimits(model, { hostedInputLimit: 250_000 })
        expect(raised.hostedInputLimit).toBe(250_000)

        // The model limit is still the hard cap for hosted.
        const clamped = resolveContextLimits(model, { hostedInputLimit: 999_999_999 })
        expect(clamped.hostedInputLimit).toBe(clamped.modelInputLimit)
    })

    it("applies a dev model-limit override and re-clamps hosted beneath it", () => {
        const limits = resolveContextLimits(
            { contextLength: 1_000_000, maxTokens: 8_000 },
            { modelInputLimit: 20_000 }
        )

        expect(limits.modelInputLimit).toBe(20_000)
        expect(limits.hostedInputLimit).toBe(20_000)
    })

    it("ignores non-positive or absent overrides", () => {
        const base = resolveContextLimits({ contextLength: 200_000, maxTokens: 8_000 })
        const withJunk = resolveContextLimits(
            { contextLength: 200_000, maxTokens: 8_000 },
            { hostedInputLimit: 0, modelInputLimit: Number.NaN }
        )

        expect(withJunk.hostedInputLimit).toBe(base.hostedInputLimit)
        expect(withJunk.modelInputLimit).toBe(base.modelInputLimit)
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

describe("computeSuggestedModels", () => {
    // Cheap models (low price) get a large hosted window; an estimate of 10k
    // tokens fits everything except the deliberately pricey "too expensive" ones.
    const ESTIMATED_TOKENS = 10_000

    const makeCandidate = (
        id: string,
        overrides: Partial<ModelSuggestionCandidate> = {}
    ): ModelSuggestionCandidate => ({
        id,
        name: id,
        abilities: [],
        runnable: true,
        requiredPlan: "free",
        contextLength: 1_000_000,
        maxTokens: 8_000,
        inputUsdPer1MTokens: 1,
        developer: "Anthropic",
        releaseOrder: 1,
        legacy: false,
        ...overrides
    })

    const suggest = (candidates: ModelSuggestionCandidate[], overrides = {}) =>
        computeSuggestedModels({
            currentModelId: "current",
            currentModelAbilities: [],
            currentModelDeveloper: "Anthropic",
            estimatedTokens: ESTIMATED_TOKENS,
            userPlan: "pro",
            candidates,
            ...overrides
        })

    it("ranks same-provider first, then cheapest, then newest as a tiebreak", () => {
        const result = suggest([
            makeCandidate("other-cheap", { developer: "OpenAI", inputUsdPer1MTokens: 2 }),
            makeCandidate("same-old", { inputUsdPer1MTokens: 5, releaseOrder: 1 }),
            makeCandidate("same-new", { inputUsdPer1MTokens: 5, releaseOrder: 2 }),
            makeCandidate("same-cheapest", { inputUsdPer1MTokens: 1, releaseOrder: 1 })
        ])

        expect(result.map((model) => model.id)).toEqual(["same-cheapest", "same-new", "same-old"])
    })

    it("excludes the current model, legacy, non-runnable, and image models", () => {
        const result = suggest([
            makeCandidate("current"),
            makeCandidate("legacy", { legacy: true }),
            makeCandidate("not-runnable", { runnable: false }),
            makeCandidate("image", { mode: "image" }),
            makeCandidate("ok")
        ])

        expect(result.map((model) => model.id)).toEqual(["ok"])
    })

    it("requires candidates to preserve the current model's modalities", () => {
        const result = suggest(
            [
                makeCandidate("text-only", { abilities: ["function_calling"] }),
                makeCandidate("vision", { abilities: ["vision", "function_calling"] })
            ],
            { currentModelAbilities: ["vision", "function_calling"] }
        )

        expect(result.map((model) => model.id)).toEqual(["vision"])
    })

    it("drops pro-only models for free users", () => {
        const result = suggest(
            [
                makeCandidate("pro-only", { requiredPlan: "pro" }),
                makeCandidate("free-ok", { requiredPlan: "free" })
            ],
            { userPlan: "free" }
        )

        expect(result.map((model) => model.id)).toEqual(["free-ok"])
    })

    it("excludes models too expensive to fit the hosted window", () => {
        // price 100 → hosted window ~5k tokens, below the 10k estimate.
        const result = suggest([
            makeCandidate("too-expensive", { inputUsdPer1MTokens: 100 }),
            makeCandidate("affordable", { inputUsdPer1MTokens: 1 })
        ])

        expect(result.map((model) => model.id)).toEqual(["affordable"])
    })

    it("returns an empty list when nothing qualifies", () => {
        expect(suggest([makeCandidate("too-expensive", { inputUsdPer1MTokens: 100 })])).toEqual([])
    })

    it("caps the number of suggestions", () => {
        const result = suggest(
            Array.from({ length: 5 }, (_, index) =>
                makeCandidate(`model-${index}`, { inputUsdPer1MTokens: index + 1 })
            ),
            { limit: 2 }
        )

        expect(result).toHaveLength(2)
    })

    it("falls back to the credit tier when price is unavailable", () => {
        const result = suggest([
            makeCandidate("pro-tier", {
                inputUsdPer1MTokens: undefined,
                prototypeCreditTier: "pro"
            }),
            makeCandidate("basic-tier", {
                inputUsdPer1MTokens: undefined,
                prototypeCreditTier: "basic"
            })
        ])

        expect(result.map((model) => model.id)).toEqual(["basic-tier", "pro-tier"])
    })
})
