import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const XIAOMI_MODELS: SharedModel[] = [
    {
        id: "mimo-v2.5-pro",
        name: "MiMo V2.5 Pro",
        shortName: "MiMo V2.5 Pro",
        releaseOrder: 20260422,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2.5-pro"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 1_048_576,
        supportsDisablingReasoning: true,
        developer: "Xiaomi"
    },
    {
        id: "mimo-v2.5",
        name: "MiMo V2.5",
        shortName: "MiMo V2.5",
        releaseOrder: 20260423,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2.5"),
        abilities: ["reasoning", "vision", "function_calling"],
        contextLength: 262_144,
        supportsDisablingReasoning: true,
        developer: "Xiaomi"
    },
    {
        id: "mimo-v2-flash",
        name: "MiMo V2 Flash",
        shortName: "MiMo V2 Flash",
        releaseOrder: 20251214,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2-flash"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 262_144,
        supportsDisablingReasoning: true,
        developer: "Xiaomi",
        legacy: true,
        sunsetOn: "2026-06-30",
        replacementId: "mimo-v2.5"
    },
    {
        id: "mimo-v2-pro",
        name: "MiMo V2 Pro",
        shortName: "MiMo V2 Pro",
        releaseOrder: 20260318,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2-pro"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 1_048_576,
        supportsDisablingReasoning: true,
        developer: "Xiaomi",
        legacy: true,
        sunsetOn: "2026-06-30",
        replacementId: "mimo-v2.5-pro"
    },
    {
        id: "mimo-v2-omni",
        name: "MiMo V2 Omni",
        shortName: "MiMo V2 Omni",
        releaseOrder: 20260318,
        adapters: openRouterTextAdapters("xiaomi/mimo-v2-omni"),
        abilities: ["reasoning", "vision", "function_calling"],
        contextLength: 262_144,
        supportsDisablingReasoning: true,
        developer: "Xiaomi",
        legacy: true,
        sunsetOn: "2026-06-30",
        replacementId: "mimo-v2.5"
    }
]
