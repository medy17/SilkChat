import {
    filterAndSortGeneratedImages,
    getGeneratedImageFilterOptions,
    getGeneratedImageOrientation,
    hasActiveGeneratedImageFilters,
    matchesGeneratedImageFilters,
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

    it("normalizes all-style filter values away", () => {
        expect(
            normalizeGeneratedImageFilters({
                modelId: "all",
                resolution: "",
                aspectRatio: "1:1",
                orientation: "portrait"
            })
        ).toEqual({
            modelId: undefined,
            resolution: undefined,
            aspectRatio: "1:1",
            orientation: "portrait"
        })
    })

    it("matches images against all active filters", () => {
        expect(
            matchesGeneratedImageFilters(
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    aspectRatio: "9:16"
                },
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    orientation: "portrait"
                }
            )
        ).toBe(true)

        expect(
            matchesGeneratedImageFilters(
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    aspectRatio: "9:16"
                },
                {
                    orientation: "landscape"
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
                filters: { modelId: "a" },
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
                    aspectRatio: "16:9"
                },
                {
                    modelId: "gpt-image-1",
                    resolution: "1K",
                    aspectRatio: "1:1"
                },
                {
                    modelId: "flux-1",
                    resolution: "1K",
                    aspectRatio: "9:16"
                }
            ])
        ).toEqual({
            modelIds: ["flux-1", "gpt-image-1"],
            resolutions: ["1K", "2K"],
            aspectRatios: ["16:9", "1:1", "9:16"],
            orientations: ["landscape", "portrait", "square"]
        })
    })

    it("detects active filters", () => {
        expect(hasActiveGeneratedImageFilters({})).toBe(false)
        expect(hasActiveGeneratedImageFilters({ orientation: "square" })).toBe(true)
    })
})
