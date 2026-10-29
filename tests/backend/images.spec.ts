import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api, internal } from "../../convex/_generated/api"
import {
    MAX_GENERATED_IMAGE_INDEX_RANGES,
    planGeneratedImageIndexScan
} from "../../convex/lib/generated_image_query_plan"
import schema from "../../convex/schema"
import {
    filterAndSortGeneratedImages,
    type GeneratedImageFilters
} from "@/lib/generated-image-filters"

const modules = import.meta.glob("../../convex/**/*.ts")

type SeedImage = {
    key: string
    createdAt: number
    modelId?: string
    resolution?: string
    aspectRatio?: string
    prompt?: string
}

const setup = async (images: SeedImage[]) => {
    const t = convexTest(schema, modules)
    const user = t.withIdentity({ subject: "user-1" })
    const ids = new Map<string, string>()
    for (const image of images) {
        const { key, ...rest } = image
        const id = await t.mutation(internal.images.insertGeneratedImage, {
            userId: "user-1",
            storageKey: key,
            ...rest
        })
        ids.set(key, id)
    }
    // Another user's images must never leak into these pages.
    await t.mutation(internal.images.insertGeneratedImage, {
        userId: "user-2",
        storageKey: "other-user",
        modelId: "flux",
        resolution: "1K",
        aspectRatio: "1:1",
        createdAt: 1
    })

    const readAll = async (
        args: {
            filters?: GeneratedImageFilters
            sortBy?: "newest" | "oldest" | "relevance"
            view?: "active" | "archived"
            query?: string
        },
        numItems = 3
    ) => {
        const pages: string[][] = []
        let cursor: string | null = null
        for (let guard = 0; guard < 200; guard++) {
            const result: {
                page: { storageKey: string }[]
                isDone: boolean
                continueCursor: string
            } = await user.query(api.images.paginateGeneratedImages, {
                paginationOpts: { numItems, cursor },
                view: "active",
                ...args
            })
            pages.push(result.page.map((image) => image.storageKey))
            if (result.isDone) return pages
            cursor = result.continueCursor
        }
        throw new Error("Pagination did not finish")
    }

    return { t, user, ids, readAll }
}

const MODELS = ["flux", "seedream-5-lite", "gpt-image"]
const RESOLUTIONS = ["1K", "2K", "4K", undefined]
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "1024x1536", "1025x1024", undefined]

// A varied library where every model, resolution and ratio is interleaved
// through time, so no filter's matches sit together in one index range.
const seedLibrary = (count: number): SeedImage[] =>
    Array.from({ length: count }, (_, index) => ({
        key: `image-${index}`,
        createdAt: 1_000 + index,
        modelId: MODELS[index % MODELS.length],
        resolution: RESOLUTIONS[(index * 7) % RESOLUTIONS.length],
        aspectRatio: ASPECT_RATIOS[(index * 5) % ASPECT_RATIOS.length]
    }))

const expectedKeys = (
    images: SeedImage[],
    filters: GeneratedImageFilters,
    sortBy: "newest" | "oldest"
) => filterAndSortGeneratedImages(images, { filters, sortBy }).map((image) => image.key)

const choices = <T>(values: T[]) => [[], [values[0]], [values[1], values[2]]] as T[][]

describe("paginateGeneratedImages", () => {
    it("fills every page with matches when they are spread thinly through the library", async () => {
        const images = Array.from({ length: 60 }, (_, index) => ({
            key: `image-${index}`,
            createdAt: index,
            modelId: index % 10 === 0 ? "seedream-5-lite" : "flux",
            resolution: "1K",
            aspectRatio: "3:4"
        }))
        const { readAll } = await setup(images)

        expect(await readAll({ filters: { modelIds: ["seedream-5-lite"] } })).toEqual([
            ["image-50", "image-40", "image-30"],
            ["image-20", "image-10", "image-0"],
            []
        ])
    })

    it("returns exactly the reference matches, in order and in full pages, for every filter combination", async () => {
        const images = seedLibrary(48)
        const { readAll } = await setup(images)
        const orientationChoices = [[], ["portrait"], ["portrait", "square"]] as const

        for (const modelIds of choices(MODELS))
            for (const resolutions of choices(["1K", "2K", "4K"]))
                for (const aspectRatios of choices(["1:1", "16:9", "2:3"]))
                    for (const orientations of orientationChoices) {
                        const filters = {
                            modelIds,
                            resolutions,
                            aspectRatios,
                            orientations: [...orientations]
                        }
                        for (const sortBy of ["newest", "oldest"] as const) {
                            const pages = await readAll({ filters, sortBy })
                            const label = JSON.stringify({ filters, sortBy })
                            expect(pages.flat(), label).toEqual(
                                expectedKeys(images, filters, sortBy)
                            )
                            // Only the final page may be short.
                            for (const page of pages.slice(0, -1)) {
                                expect(page, label).toHaveLength(3)
                            }
                        }
                    }
    })

    it("stays exact when a selection is too wide to give every value its own index range", async () => {
        const models = Array.from({ length: 8 }, (_, index) => `model-${index}`)
        const images = Array.from({ length: 64 }, (_, index) => ({
            key: `image-${index}`,
            createdAt: index,
            modelId: models[index % models.length],
            resolution: ["1K", "2K", "4K"][index % 3],
            aspectRatio: ["1:1", "16:9", "9:16", "4:3"][index % 4]
        }))
        const filters = {
            modelIds: models.slice(0, 7),
            resolutions: ["1K", "2K", "4K"],
            aspectRatios: ["1:1", "16:9", "9:16"],
            orientations: ["portrait" as const, "square" as const]
        }
        const { readAll } = await setup(images)

        expect((await readAll({ filters }, 5)).flat()).toEqual(
            expectedKeys(images, filters, "newest")
        )
    })

    it("keeps missing and false archive flags active in one chronological order", async () => {
        const images = seedLibrary(6)
        const { user, ids, readAll } = await setup(images)
        await user.mutation(api.images.archiveGeneratedImage, { id: ids.get("image-4") as never })
        await user.mutation(api.images.archiveGeneratedImage, { id: ids.get("image-1") as never })
        // Restored images carry `isArchived: false` while older ones have no flag.
        await user.mutation(api.images.restoreGeneratedImage, { id: ids.get("image-1") as never })

        expect((await readAll({})).flat()).toEqual([
            "image-5",
            "image-3",
            "image-2",
            "image-1",
            "image-0"
        ])
        expect((await readAll({ view: "archived" })).flat()).toEqual(["image-4"])
        expect((await readAll({ filters: { modelIds: ["seedream-5-lite"] } })).flat()).toEqual([
            "image-1"
        ])
    })

    it("applies multi-value filters to search results", async () => {
        const images = seedLibrary(12).map((image, index) => ({
            ...image,
            prompt: index % 2 === 0 ? "a red fox in snow" : "city skyline at night"
        }))
        const filters = { modelIds: ["flux", "gpt-image"], resolutions: ["1K"] }
        const { readAll } = await setup(images)

        const found = (await readAll({ query: "fox", sortBy: "relevance", filters }, 50)).flat()
        const expected = images
            .filter((image) => image.prompt.includes("fox"))
            .filter((image) => filters.modelIds.includes(image.modelId ?? ""))
            .filter((image) => image.resolution === "1K")
            .map((image) => image.key)
        expect(found.sort()).toEqual(expected.sort())
    })

    it("returns an exhausted empty page for an unauthenticated user", async () => {
        const t = convexTest(schema, modules)
        expect(
            await t.query(api.images.paginateGeneratedImages, {
                paginationOpts: { numItems: 20, cursor: null },
                view: "active"
            })
        ).toEqual({ page: [], isDone: true, continueCursor: "" })
    })
})

describe("planGeneratedImageIndexScan", () => {
    const counts = {
        modelIds: { flux: 900, "seedream-5-lite": 40, "gpt-image": 60 },
        resolutions: { "1K": 500, "2K": 300, "4K": 200 },
        aspectRatios: { "1:1": 400, "16:9": 300, "9:16": 300 },
        orientations: { square: 400, landscape: 300, portrait: 300 }
    }

    it("covers every selected group with exact ranges when they fit", () => {
        const plan = planGeneratedImageIndexScan({
            filters: {
                modelIds: ["seedream-5-lite", "gpt-image"],
                resolutions: ["2K", "4K"],
                orientations: ["portrait", "square"]
            },
            archiveStateCount: 2,
            counts
        })
        expect(plan.indexName).toBe("byUserArchivedModelResolutionOrientationCreatedAt")
        expect(plan.ranges).toHaveLength(8)
        expect(plan.needsRowFilter).toBe(false)
    })

    it("leaves the least selective group to a row check when ranges would exceed the cap", () => {
        const plan = planGeneratedImageIndexScan({
            filters: {
                modelIds: ["seedream-5-lite", "gpt-image"],
                resolutions: ["1K", "2K", "4K"],
                aspectRatios: ["1:1", "16:9", "9:16"],
                orientations: ["portrait", "square", "landscape"]
            },
            archiveStateCount: 2,
            counts
        })
        expect(plan.ranges.length * 2).toBeLessThanOrEqual(MAX_GENERATED_IMAGE_INDEX_RANGES)
        expect(plan.fields).toContain("modelId")
        expect(plan.needsRowFilter).toBe(true)
    })
})
