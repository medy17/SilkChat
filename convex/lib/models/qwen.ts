import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const QWEN_MODELS: SharedModel[] = [
    {
        id: "qwen3.6-plus",
        name: "Qwen3.6 Plus",
        addedOn: "2026-04-02",
        shortName: "Qwen3.6 Plus",
        shortDescription: "Million-token coding agent with broad language fluency and steady hands",
        description:
            "Qwen3.6 Plus is Alibaba's hosted long-context workhorse for repository-scale reasoning, tool use, and iterative development. It couples a million-token window with the Qwen 3.6 family's stronger frontend instincts, thinking preservation, and unusually broad multilingual reach.",
        releaseOrder: 20260402,
        adapters: openRouterTextAdapters("qwen/qwen3.6-plus"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 1_000_000,
        developer: "Qwen"
    }
]
