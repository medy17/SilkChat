import {
    filterAndSortGeneratedImages,
    getGeneratedImageFilterOptions,
    getGeneratedImageOrientation,
    hasActiveGeneratedImageFilters,
    matchesGeneratedImageFilters,
    normalizeGeneratedImageAspectRatio,
    normalizeGeneratedImageFilters
} from "@/lib/generated-image-filters"
import { describe, expect, it } from "vitest"

describe("generated-image-filters", () => {
    it("derives image orientation from aspect ratios", () => {
        expect(getGeneratedImageOrientation("16:9")).toBe("landscape")
        expect(getGeneratedImageOrientation("9:16")).toBe("portrait")
        expect(getGeneratedImageOrientation("1:1")).toBe("square")
        expect(getGeneratedImageOrientation(undefined)).toBeUndefined()
    })

    it("normalizes quirky post-generation aspect ratios to simple buckets", () => {
        expect(normalizeGeneratedImageAspectRatio("1024x1024")).toBe("1:1")
        expect(normalizeGeneratedImageAspectRatio("1792x1024")).toBe("16:9")
        expect(normalizeGeneratedImageAspectRatio("27:37")).toBe("3:4")
        expect(normalizeGeneratedImageAspectRatio("111:158")).toBe("3:4")
    })

    it("normalizes all-style filter values away", () => {
        expect(
            normalizeGeneratedImageFilters({
                modelIds: ["", "flux-1", "flux-1"],
                resolutions: [],
                aspectRatios: ["1:1", "1024x1024"],
                orientations: ["portrait"]
            })
        ).toEqual({
            modelIds: ["flux-1"],
            resolutions: undefined,
            aspectRatios: ["1:1"],
            orientations: ["portrait"]
        })
    })

    it("matches images against all active filters", () => {
        expect(
            matchesGeneratedImageFilters(
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    aspectRatio: "896x1536"
                },
                {
                    modelIds: ["flux-1", "seedream"],
                    resolutions: ["1K"],
                    orientations: ["portrait"]
                }
            )
        ).toBe(true)

        expect(
            matchesGeneratedImageFilters(
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    aspectRatio: "1024x1024"
                },
                {
                    aspectRatios: ["1:1"]
                }
            )
        ).toBe(true)

        expect(
            matchesGeneratedImageFilters(
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    aspectRatio: "1024x1024"
                },
                {
                    orientations: ["landscape"]
                }
            )
        ).toBe(false)
    })

    it("sorts and filters images across the full set", () => {
        const images = [
            { modelId: "a", resolution: "1K", aspectRatio: "1:1", createdAt: 10 },
            { modelId: "b", resolution: "2K", aspectRatio: "16:9", createdAt: 30 },
            { modelId: "a", resolution: "2K", aspectRatio: "9:16", createdAt: 20 }
        ]

        expect(
            filterAndSortGeneratedImages(images, {
                filters: { modelIds: ["a"] },
                sortBy: "newest"
            }).map((image) => image.createdAt)
        ).toEqual([20, 10])
    })

    it("extracts distinct filter options", () => {
        expect(
            getGeneratedImageFilterOptions([
                {
                    modelId: "flux-1",
                    resolution: "2K",
                    aspectRatio: "1792x1024"
                },
                {
                    modelId: "gpt-image-1",
                    resolution: "1K",
                    aspectRatio: "1024x1024"
                },
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    aspectRatio: "27:37"
                }
            ])
        ).toEqual({
            modelIds: ["flux-1", "gpt-image-1"],
            resolutions: ["1K", "2K"],
            aspectRatios: ["16:9", "1:1", "3:4"],
            orientations: ["landscape", "portrait", "square"]
        })
    })

    it("detects active filters", () => {
        expect(hasActiveGeneratedImageFilters({})).toBe(false)
        expect(hasActiveGeneratedImageFilters({ orientations: ["square"] })).toBe(true)
    })
})
