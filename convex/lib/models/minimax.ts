import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const MINIMAX_MODELS: SharedModel[] = [
    {
        id: "minimax-m2.7",
        name: "MiniMax M2.7",
        shortName: "M2.7",
        releaseOrder: 20260318,
        adapters: openRouterTextAdapters("minimax/minimax-m2.7"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 196_608,
        developer: "MiniMax"
    }
]
