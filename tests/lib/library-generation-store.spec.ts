// @vitest-environment jsdom

import {
    FAL_IMAGE_MIGRATION_STORAGE_RESET_KEY,
    LIBRARY_GENERATION_STORE_KEY,
    clearFalImageMigrationStorageOnce,
    useGenerationStore
} from "@/components/library/generation-store"
import { getLibraryBatchColor } from "@/lib/library-batch"
import { beforeEach, describe, expect, it } from "vitest"

describe("library-generation-store", () => {
    beforeEach(() => {
        localStorage.removeItem(LIBRARY_GENERATION_STORE_KEY)
        localStorage.removeItem(FAL_IMAGE_MIGRATION_STORAGE_RESET_KEY)
        useGenerationStore.setState({
            lastBatchId: undefined,
            pendingGenerations: [],
            completedGenerationCount: 0,
            prompt: "",
            selectedModelIds: [],
            selectedModelCounts: {},
            aspectRatio: "1:1",
            resolution: "1K"
        })
    })

    it("keeps batch colours stable after reload and cycles colours without reusing IDs", async () => {
        const first = useGenerationStore.getState().startBatch()
        const firstColor = getLibraryBatchColor(first)
        expect(firstColor).toBeDefined()
        await useGenerationStore.persist.rehydrate()
        expect(useGenerationStore.getState().lastBatchId).toBe(first)
        const next = useGenerationStore.getState().startBatch()
        expect(getLibraryBatchColor(next)).not.toBe(firstColor)
        const ids = [first, next]
        for (let i = 0; i < 5; i++) ids.push(useGenerationStore.getState().startBatch())
        expect(new Set(ids).size).toBe(7)
        expect(getLibraryBatchColor(ids[6])).toBe(firstColor)
        expect(getLibraryBatchColor(first)).toBe(firstColor)
        expect(getLibraryBatchColor(undefined)).toBeUndefined()
    })

    it("persists library generation preferences", () => {
        useGenerationStore.getState().setPrompt("sunset over the ocean")
        useGenerationStore.getState().setSelectedModelIds(["image-a", "image-b"])
        useGenerationStore.getState().setSelectedModelCounts({ "image-a": 2, "image-b": 1 })
        useGenerationStore.getState().setAspectRatio("16:9")
        useGenerationStore.getState().setResolution("2K")

        expect(useGenerationStore.getState()).toMatchObject({
            prompt: "sunset over the ocean",
            selectedModelIds: ["image-a", "image-b"],
            selectedModelCounts: { "image-a": 2, "image-b": 1 },
            aspectRatio: "16:9",
            resolution: "2K"
        })

        expect(JSON.parse(localStorage.getItem(LIBRARY_GENERATION_STORE_KEY) || "{}")).toEqual({
            state: {
                prompt: "sunset over the ocean",
                selectedModelIds: ["image-a", "image-b"],
                selectedModelCounts: { "image-a": 2, "image-b": 1 },
                aspectRatio: "16:9",
                resolution: "2K"
            },
            version: 0
        })
    })

    it("keeps pending generation state out of persistence", () => {
        useGenerationStore.getState().addPendingGeneration({
            id: "pending-1",
            aspectRatio: "1:1"
        })
        useGenerationStore.getState().removePendingGeneration("pending-1")

        expect(useGenerationStore.getState()).toMatchObject({
            pendingGenerations: [],
            completedGenerationCount: 1
        })

        expect(JSON.parse(localStorage.getItem(LIBRARY_GENERATION_STORE_KEY) || "{}")).toEqual({
            state: {
                prompt: "",
                selectedModelIds: [],
                selectedModelCounts: {},
                aspectRatio: "1:1",
                resolution: "1K"
            },
            version: 0
        })
    })

    it("can clear an accepted fal placeholder without counting a completed generation", () => {
        useGenerationStore.getState().addPendingGeneration({
            id: "pending-1",
            aspectRatio: "1:1"
        })
        useGenerationStore
            .getState()
            .removePendingGeneration("pending-1", { countCompleted: false })

        expect(useGenerationStore.getState()).toMatchObject({
            pendingGenerations: [],
            completedGenerationCount: 0
        })
    })

    it("clears fal migration-sensitive library storage once", () => {
        localStorage.setItem(LIBRARY_GENERATION_STORE_KEY, JSON.stringify({ stale: true }))
        localStorage.setItem("legacy-image-model-migrated:old:new", "true")
        localStorage.setItem("unrelated-key", "keep")

        clearFalImageMigrationStorageOnce(localStorage)

        expect(localStorage.getItem(LIBRARY_GENERATION_STORE_KEY)).toBeNull()
        expect(localStorage.getItem("legacy-image-model-migrated:old:new")).toBeNull()
        expect(localStorage.getItem("unrelated-key")).toBe("keep")
        expect(localStorage.getItem(FAL_IMAGE_MIGRATION_STORAGE_RESET_KEY)).toBe("true")

        localStorage.setItem(LIBRARY_GENERATION_STORE_KEY, JSON.stringify({ fresh: true }))
        clearFalImageMigrationStorageOnce(localStorage)

        expect(JSON.parse(localStorage.getItem(LIBRARY_GENERATION_STORE_KEY) || "{}")).toEqual({
            fresh: true
        })
    })
})
