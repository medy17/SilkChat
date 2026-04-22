import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const QWEN_MODELS: SharedModel[] = [
    {
        id: "qwen3.6-plus",
        name: "Qwen3.6 Plus",
        shortName: "Qwen3.6 Plus",
        releaseOrder: 20260402,
        adapters: openRouterTextAdapters("qwen/qwen3.6-plus"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 1_000_000,
        developer: "Qwen"
    }
]
