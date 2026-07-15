import { getModelCostLevel, getModelEffectivePrice } from "@/lib/model-cost"
import { describe, expect, it } from "vitest"

describe("model cost indicators", () => {
    it.each([
        [0.1, 0.3, 0, "very cheap models"],
        [0.3, 1.2, 1, "low-cost models"],
        [0.5, 3, 1, "flash models"],
        [1.4, 4.4, 2, "mid-priced models"],
        [1.5, 9, 2, "higher-output-cost flash models"],
        [2.5, 15, 3, "flagship models"],
        [3, 15, 3, "premium everyday models"],
        [5, 25, 4, "exceptionally expensive models"],
        [5, 30, 4, "top-priced reasoning models"]
    ])("classifies %s input / %s output as level %s for %s", (input, output, level) => {
        expect(
            getModelCostLevel({
                inputUsdPer1MTokens: input,
                outputUsdPer1MTokens: output
            })
        ).toBe(level)
    })

    it("uses the geometric mean so proportional input and output changes are symmetric", () => {
        expect(
            getModelEffectivePrice({
                inputUsdPer1MTokens: 1,
                outputUsdPer1MTokens: 9
            })
        ).toBe(3)
        expect(
            getModelEffectivePrice({
                inputUsdPer1MTokens: 3,
                outputUsdPer1MTokens: 3
            })
        ).toBe(3)
    })

    it("keeps nearby prices in the same logarithmic cost band", () => {
        expect(
            getModelCostLevel({
                inputUsdPer1MTokens: 0.98,
                outputUsdPer1MTokens: 4.9
            })
        ).toBe(2)
        expect(
            getModelCostLevel({
                inputUsdPer1MTokens: 1.1,
                outputUsdPer1MTokens: 5.5
            })
        ).toBe(2)
    })

    it("does not present missing or partial pricing as the cheapest tier", () => {
        expect(getModelCostLevel({})).toBeNull()
        expect(getModelCostLevel({ inputUsdPer1MTokens: 1 })).toBeNull()
        expect(getModelCostLevel({ inputUsdPer1MTokens: 0, outputUsdPer1MTokens: 0 })).toBe(0)
    })
})
