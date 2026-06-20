import {
    SELECTABLE_IMAGE_ASPECT_RATIOS,
    getCommonSelectableImageAspectRatios,
    getSelectableImageAspectRatios,
    normalizeExactImageAspectRatio
} from "@/lib/image-aspect-ratios"
import { describe, expect, it } from "vitest"
import { MODELS_SHARED } from "../../convex/lib/models"

const supportedSizesFor = (modelId: string) => {
    const model = MODELS_SHARED.find((candidate) => candidate.id === modelId)
    if (!model) throw new Error(`Missing shared model ${modelId}`)

    return model.supportedImageSizes
}

describe("image-aspect-ratios", () => {
    it("returns all selectable aspect ratios when a model does not declare supported sizes", () => {
        expect(getSelectableImageAspectRatios(undefined)).toEqual([
            ...SELECTABLE_IMAGE_ASPECT_RATIOS
        ])
    })

    it("returns only supported selectable ratios", () => {
        expect(getSelectableImageAspectRatios(["1:1", "3:4", "5:4"])).toEqual(["1:1", "3:4"])
    })

    it("normalizes exact ratios without snapping unsupported sizes to nearby selectable ones", () => {
        expect(normalizeExactImageAspectRatio("1536x1024")).toBe("3:2")
        expect(normalizeExactImageAspectRatio("1024x1536")).toBe("2:3")
        expect(normalizeExactImageAspectRatio("16:9-hd")).toBe("16:9")
        expect(normalizeExactImageAspectRatio("21:9")).toBe("21:9")
    })

    it("exposes investigated fal ratios through shared model metadata", () => {
        expect(
            getSelectableImageAspectRatios(supportedSizesFor("gemini-2.5-flash-image"))
        ).toContain("21:9")
        expect(
            getSelectableImageAspectRatios(supportedSizesFor("gemini-3.1-flash-image-preview"))
        ).toContain("21:9")
        expect(getSelectableImageAspectRatios(supportedSizesFor("seedream-4-5"))).toContain("21:9")
        expect(getSelectableImageAspectRatios(supportedSizesFor("gpt-5-image"))).toEqual(
            expect.arrayContaining(["16:9", "9:16"])
        )
        expect(getSelectableImageAspectRatios(supportedSizesFor("gpt-5-image-mini"))).toEqual(
            expect.arrayContaining(["16:9", "9:16"])
        )
    })

    it("keeps 21:9 selectable when selected fal models all support it", () => {
        expect(
            getCommonSelectableImageAspectRatios([
                supportedSizesFor("gpt-5.4-image-2"),
                supportedSizesFor("gemini-3.1-flash-image-preview"),
                supportedSizesFor("seedream-4-5")
            ])
        ).toContain("21:9")
    })
})
