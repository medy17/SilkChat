import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const DEEPSEEK_MODELS: SharedModel[] = [
    {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        shortName: "DS V4 Pro",
        releaseOrder: 20251203,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-pro"),
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        shortName: "DS V4 Flash",
        releaseOrder: 20251202,
        adapters: openRouterTextAdapters("deepseek/deepseek-v4-flash"),
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek"
    },
    {
        id: "deepseek-v3.2",
        name: "DeepSeek V3.2",
        shortName: "DS V3.2",
        releaseOrder: 20251201,
        adapters: openRouterTextAdapters("deepseek/deepseek-v3.2"),
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        developer: "DeepSeek",
        legacy: true,
        replacementId: "deepseek-v4-flash"
    }
]
