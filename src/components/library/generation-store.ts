import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface PendingGeneration {
    id: string
    aspectRatio: string
}

export const LIBRARY_GENERATION_STORE_KEY = "library-generation-store"
export const FAL_IMAGE_MIGRATION_STORAGE_RESET_KEY = "fal-image-migration-storage-reset:v1"

const LEGACY_IMAGE_MODEL_MIGRATION_KEY_PREFIX = "legacy-image-model-migrated:"

export const clearFalImageMigrationStorageOnce = (storage: Storage) => {
    try {
        if (storage.getItem(FAL_IMAGE_MIGRATION_STORAGE_RESET_KEY) === "true") {
            return
        }

        storage.removeItem(LIBRARY_GENERATION_STORE_KEY)

        for (const key of Object.keys(storage)) {
            if (key.startsWith(LEGACY_IMAGE_MODEL_MIGRATION_KEY_PREFIX)) {
                storage.removeItem(key)
            }
        }

        storage.setItem(FAL_IMAGE_MIGRATION_STORAGE_RESET_KEY, "true")
    } catch {
        // localStorage can be unavailable in restricted browser contexts.
    }
}

if (typeof window !== "undefined") {
    clearFalImageMigrationStorageOnce(window.localStorage)
}

interface GenerationStore {
    pendingGenerations: PendingGeneration[]
    completedGenerationCount: number
    prompt: string
    selectedModelIds: string[]
    selectedModelCounts: Record<string, number>
    aspectRatio: string
    resolution: string
    addPendingGeneration: (info: PendingGeneration) => void
    removePendingGeneration: (id: string) => void
    setPrompt: (prompt: string) => void
    setSelectedModelIds: (modelIds: string[] | ((currentModelIds: string[]) => string[])) => void
    setSelectedModelCounts: (
        modelCounts:
            | Record<string, number>
            | ((currentModelCounts: Record<string, number>) => Record<string, number>)
    ) => void
    setAspectRatio: (aspectRatio: string) => void
    setResolution: (resolution: string) => void
}

export const useGenerationStore = create<GenerationStore>()(
    persist(
        (set) => ({
            pendingGenerations: [],
            completedGenerationCount: 0,
            prompt: "",
            selectedModelIds: [],
            selectedModelCounts: {},
            aspectRatio: "1:1",
            resolution: "1K",
            addPendingGeneration: (info) =>
                set((state) => ({
                    pendingGenerations: [info, ...state.pendingGenerations]
                })),
            removePendingGeneration: (id) =>
                set((state) => ({
                    pendingGenerations: state.pendingGenerations.filter((p) => p.id !== id),
                    completedGenerationCount: state.completedGenerationCount + 1
                })),
            setPrompt: (prompt) => set({ prompt }),
            setSelectedModelIds: (modelIds) =>
                set((state) => ({
                    selectedModelIds:
                        typeof modelIds === "function" ? modelIds(state.selectedModelIds) : modelIds
                })),
            setSelectedModelCounts: (modelCounts) =>
                set((state) => ({
                    selectedModelCounts:
                        typeof modelCounts === "function"
                            ? modelCounts(state.selectedModelCounts)
                            : modelCounts
                })),
            setAspectRatio: (aspectRatio) => set({ aspectRatio }),
            setResolution: (resolution) => set({ resolution })
        }),
        {
            name: LIBRARY_GENERATION_STORE_KEY,
            partialize: (state) => ({
                prompt: state.prompt,
                selectedModelIds: state.selectedModelIds,
                selectedModelCounts: state.selectedModelCounts,
                aspectRatio: state.aspectRatio,
                resolution: state.resolution
            })
        }
    )
)
