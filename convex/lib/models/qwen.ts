import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const QWEN_MODELS: SharedModel[] = [
    {
        id: "qwen3.8-2.4t-a95b",
        name: "Qwen3.8 2.4T A95B",
        addedOn: "2026-08-12",
        shortName: "Qwen3.8 A95B",
        shortDescription:
            "Open sparse giant with 95B active parameters for deep reasoning and coding",
        description:
            "Qwen3.8 2.4T A95B is Qwen's open-weight sparse mixture-of-experts model, activating 95B of its 2.4T parameters. A million-token context, controllable reasoning, structured output, and tool use make it a strong fit for deep analysis, repository-scale coding, and complex automated workflows.",
        releaseOrder: 20260812,
        adapters: openRouterTextAdapters("qwen/qwen3.8-2.4t-a95b"),
        abilities: ["reasoning", "function_calling", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 52_429,
        inputUsdPer1MTokens: 2,
        outputUsdPer1MTokens: 6,
        reasoningEfforts: ["low", "medium"],
        defaultReasoningEffort: "medium",
        developer: "Qwen"
    },
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
