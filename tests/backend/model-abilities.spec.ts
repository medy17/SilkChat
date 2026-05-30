import { describe, expect, it } from "vitest"

import {
    NATIVE_PDF_MODEL_ABILITY,
    normalizeModelAbilities,
    supportsNativePdf
} from "../../convex/lib/model_abilities"

describe("model abilities", () => {
    it("normalizes legacy pdf abilities to native_pdf", () => {
        expect(normalizeModelAbilities(["reasoning", "pdf"])).toEqual([
            "reasoning",
            NATIVE_PDF_MODEL_ABILITY
        ])
    })

    it("detects native pdf support through normalized abilities", () => {
        expect(supportsNativePdf(["pdf"])).toBe(true)
        expect(supportsNativePdf(["native_pdf"])).toBe(true)
        expect(supportsNativePdf(["vision"])).toBe(false)
    })
})
