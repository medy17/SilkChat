import { describe, expect, it } from "vitest"

import { estimateImageInputTokens } from "@/lib/vision-token-estimate"

describe("estimateImageInputTokens", () => {
    it("uses 32px patches for ordinary images", () => {
        expect(estimateImageInputTokens({ width: 1024, height: 1024 })).toBe(1024)
    })

    it("scales large images into the conservative patch budget", () => {
        const estimate = estimateImageInputTokens({ width: 1800, height: 2400 })

        expect(estimate).toBeGreaterThan(1400)
        expect(estimate).toBeLessThanOrEqual(1536)
    })

    it("applies documented model multipliers", () => {
        expect(estimateImageInputTokens({ width: 1024, height: 1024 }, "gpt-5.4-mini")).toBe(1659)
    })

    it("falls back conservatively when dimensions are unavailable", () => {
        expect(estimateImageInputTokens(undefined)).toBe(1536)
    })
})
