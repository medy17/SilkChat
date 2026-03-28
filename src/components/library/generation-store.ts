import { create } from "zustand"

export interface PendingGeneration {
    id: string
    aspectRatio: string
}

interface GenerationStore {
    pendingGenerations: PendingGeneration[]
    completedGenerationCount: number
    addPendingGeneration: (info: PendingGeneration) => void
    removePendingGeneration: (id: string) => void
}

export const useGenerationStore = create<GenerationStore>((set) => ({
    pendingGenerations: [],
    completedGenerationCount: 0,
    addPendingGeneration: (info) =>
        set((state) => ({
            pendingGenerations: [info, ...state.pendingGenerations]
        })),
    removePendingGeneration: (id) =>
        set((state) => ({
            pendingGenerations: state.pendingGenerations.filter((p) => p.id !== id),
            completedGenerationCount: state.completedGenerationCount + 1
        }))
}))
