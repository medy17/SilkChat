import { describe, expect, it } from "vitest"
import {
    MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN,
    getImageModelMaxPerMessage,
    getSelectableImageModels,
    getSupportedAspectRatiosForImageModel,
    getSupportedResolutionsForImageModel,
    validatePreparedImageRequest
} from "../../convex/lib/image_generation/shared"

const getModelSupportingResolutions = () => {
    const model = getSelectableImageModels().find(
        (candidate) => getSupportedResolutionsForImageModel(candidate).length > 0
    )
    if (!model) throw new Error("Expected at least one image model that declares resolutions")
    return model
}

const getModelWithMultipleResolutions = () => {
    const model = getSelectableImageModels().find(
        (candidate) => getSupportedResolutionsForImageModel(candidate).length >= 2
    )
    if (!model) throw new Error("Expected an image model with at least two resolutions")
    return model
}

// A model whose highest resolution is below 4K, so 4K requests must clamp down a rung.
const getModelWithResolutionCeilingBelow4K = () => {
    const model = getSelectableImageModels().find((candidate) => {
        const supported = getSupportedResolutionsForImageModel(candidate)
        return supported.length > 0 && !supported.includes("4K")
    })
    if (!model) throw new Error("Expected an image model whose resolution ceiling is below 4K")
    return model
}

describe("validatePreparedImageRequest coercion", () => {
    it("limits the free image catalog to explicitly free models", () => {
        const freeModels = getSelectableImageModels("free")
        const proModels = getSelectableImageModels("pro")

        expect(freeModels.map((model) => model.id)).toEqual(["seedream-5-lite"])
        expect(proModels.length).toBeGreaterThan(freeModels.length)
        expect(proModels).toContainEqual(expect.objectContaining({ id: "seedream-5-pro" }))
    })

    it("clamps variants above the model ceiling instead of throwing", () => {
        const model = getSelectableImageModels()[0]
        const ceiling = Math.min(
            getImageModelMaxPerMessage(model),
            MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN
        )

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            variants: ceiling + 5,
            referenceCount: 0
        })

        expect(validated.variants).toBe(ceiling)
    })

    it("defaults empty variants to 1", () => {
        const model = getSelectableImageModels()[0]

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            referenceCount: 0
        })

        expect(validated.variants).toBe(1)
    })

    it("includes the selected quality in the local credit estimate", () => {
        const validated = validatePreparedImageRequest({
            modelId: "gpt-5.4-image-2",
            aspectRatio: "1:1",
            resolution: "1K",
            quality: "high",
            referenceCount: 0
        })

        expect(validated.creditEstimate.estimatedUsd).toBe(0.211)
    })

    it("fills an empty resolution with a supported default", () => {
        const model = getModelSupportingResolutions()
        const supported = getSupportedResolutionsForImageModel(model)

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            referenceCount: 0
        })

        expect(validated.resolution).toBeDefined()
        expect(supported).toContain(validated.resolution)
        if (supported.includes("1K")) {
            expect(validated.resolution).toBe("1K")
        }
    })

    it("snaps an unsupported resolution to a supported one", () => {
        const model = getModelSupportingResolutions()
        const supported = getSupportedResolutionsForImageModel(model)

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            resolution: "unsupported-resolution",
            referenceCount: 0
        })

        expect(supported).toContain(validated.resolution)
    })

    it("snaps an unsupported aspect ratio to a supported one", () => {
        const model = getSelectableImageModels().find(
            (candidate) => getSupportedAspectRatiosForImageModel(candidate).length > 0
        )
        if (!model) throw new Error("Expected at least one model that declares aspect ratios")
        const supported = getSupportedAspectRatiosForImageModel(model)

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            aspectRatio: "definitely-not-a-real-ratio",
            referenceCount: 0
        })

        expect(supported).toContain(validated.aspectRatio)
    })

    it("applies the user default resolution when the model omits it", () => {
        const model = getModelWithMultipleResolutions()
        const supported = getSupportedResolutionsForImageModel(model)
        const preferred = supported.find((value) => value !== "1K") ?? supported[0]

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            referenceCount: 0,
            defaults: { resolution: preferred }
        })

        expect(validated.resolution).toBe(preferred)
    })

    it("lets an explicit resolution override the user default", () => {
        const model = getModelWithMultipleResolutions()
        const supported = getSupportedResolutionsForImageModel(model)
        const explicit = supported[0]
        const preferred = supported.find((value) => value !== explicit) ?? supported[0]

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            resolution: explicit,
            referenceCount: 0,
            defaults: { resolution: preferred }
        })

        expect(validated.resolution).toBe(explicit)
    })

    it("clamps a user default above the model ceiling down to the nearest supported rung", () => {
        const model = getModelWithResolutionCeilingBelow4K()
        const supported = getSupportedResolutionsForImageModel(model)
        const highest = supported.includes("2K") ? "2K" : supported[supported.length - 1]

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            referenceCount: 0,
            defaults: { resolution: "4K" }
        })

        expect(validated.resolution).toBe(highest)
    })

    it("clamps an explicit over-ceiling resolution to the model max, not the floor", () => {
        const model = getModelWithResolutionCeilingBelow4K()
        const supported = getSupportedResolutionsForImageModel(model)
        const highest = supported.includes("2K") ? "2K" : supported[supported.length - 1]

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            resolution: "4K",
            referenceCount: 0
        })

        // The explicit "high fidelity" intent is honored down to the ceiling rather than
        // collapsing to 1K.
        expect(validated.resolution).toBe(highest)
        expect(validated.resolution).not.toBe("1K")
    })

    it("applies then clamps the user default variant count", () => {
        const model = getSelectableImageModels()[0]
        const ceiling = Math.min(
            getImageModelMaxPerMessage(model),
            MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN
        )

        // Well above any per-model ceiling: proves the default is applied and then clamped.
        const validated = validatePreparedImageRequest({
            modelId: model.id,
            referenceCount: 0,
            defaults: { variants: MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN + 5 }
        })

        expect(validated.variants).toBe(ceiling)
    })

    it("lets an explicit variant count override the user default", () => {
        const model = getSelectableImageModels()[0]

        const validated = validatePreparedImageRequest({
            modelId: model.id,
            variants: 1,
            referenceCount: 0,
            defaults: { variants: MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN }
        })

        expect(validated.variants).toBe(1)
    })

    it("still rejects references for a model that does not support them", () => {
        const model = getSelectableImageModels().find(
            (candidate) => !candidate.supportsReferenceImages
        )
        if (!model) throw new Error("Expected at least one text-to-image-only model")

        expect(() =>
            validatePreparedImageRequest({
                modelId: model.id,
                referenceCount: 1
            })
        ).toThrow()
    })

    it("enforces Seedream 5 Lite's reference limit", () => {
        expect(
            validatePreparedImageRequest({
                modelId: "seedream-5-lite",
                referenceCount: 10
            }).creditEstimate.requiredPlan
        ).toBe("free")

        expect(() =>
            validatePreparedImageRequest({
                modelId: "seedream-5-lite",
                referenceCount: 11
            })
        ).toThrow("This model supports up to 10 reference images.")
    })
})
