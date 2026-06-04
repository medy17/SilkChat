import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const MINIMAX_MODELS: SharedModel[] = [
    {
        id: "minimax-m3",
        name: "MiniMax M3",
        shortName: "M3",
        shortDescription: "Frontier MiniMax model for coding, agents, long context, and vision",
        description:
            "MiniMax's frontier high-performance, multimodal model for long-horizon coding, agentic workflows, and large-context analysis at surprisingly cheap inference costs.",
        addedOn: "2026-06-01",
        releaseOrder: 20260601,
        adapters: openRouterTextAdapters("minimax/minimax-m3"),
        abilities: ["reasoning", "vision", "function_calling"],
        contextLength: 1_048_576,
        supportsDisablingReasoning: true,
        developer: "MiniMax"
    },
    {
        id: "minimax-m2.7",
        name: "MiniMax M2.7",
        shortName: "M2.7",
        shortDescription: "MiniMax productivity model for agentic engineering and office workflows",
        description:
            "MiniMax's previous generation model tuned for autonomous productivity tasks, software engineering, and multi-step agent workflows.",
        addedOn: "2026-03-18",
        releaseOrder: 20260318,
        adapters: openRouterTextAdapters("minimax/minimax-m2.7"),
        abilities: ["reasoning", "function_calling"],
        contextLength: 196_608,
        developer: "MiniMax"
    }
]
