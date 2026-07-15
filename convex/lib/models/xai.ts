import type { SharedModel } from "./types"

export const XAI_MODELS: SharedModel[] = [
    {
        id: "grok-4.5",
        name: "Grok 4.5",
        shortName: "Grok 4.5",
        shortDescription:
            "xAI Opus-class model tuned for coding, agentic tasks, and knowledge work",
        description:
            "xAI's flagship model built on the 1.5T V9 foundation. Delivers Opus-class reasoning with roughly twice the token efficiency and served at fast-model speeds. Strong multimodal understanding, tool use, and a large context window for complex, long-running conversations.",
        addedOn: "2026-07-09",
        releaseOrder: 20260709,
        adapters: ["i3-xai:grok-4.3", "xai:grok-4.3", "openrouter:x-ai/grok-4.5"],
        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
        contextLength: 500_000,
        customIcon: "xai"
    },
    {
        id: "grok-4.3",
        name: "Grok 4.3",
        shortName: "Grok 4.3",
        shortDescription:
            "xAI's previous-generation model for reasoning, vision, and function calling with effort control",
        description:
            "xAI's previous-generation model with strong multimodal reasoning, tool use, and a large context window for complex conversations. Superseded by Grok 4.5.",
        addedOn: "2026-04-30",
        releaseOrder: 20260430,
        adapters: ["i3-xai:grok-4.3", "xai:grok-4.3", "openrouter:x-ai/grok-4.3"],
        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
        contextLength: 1_000_000,
        customIcon: "xai"
    },
    {
        id: "grok-4-1-fast",
        name: "Grok 4.1 Fast",
        shortName: "Grok 4.1",
        releaseOrder: 20260321,
        adapters: [
            "i3-xai:grok-4-1-fast-non-reasoning",
            "i3-xai:grok-4-1-fast-reasoning",
            "xai:grok-4-1-fast-non-reasoning",
            "xai:grok-4-1-fast-reasoning",
            "openrouter:x-ai/grok-4.1-fast"
        ],
        abilities: ["reasoning", "function_calling"],
        contextLength: 2_000_000,
        supportsDisablingReasoning: true,
        customIcon: "xai",
        legacy: true,
        sunsetOn: "2026-05-15",
        replacementId: "grok-4.3"
    },
    {
        id: "grok-4.20-0309",
        name: "Grok 4.20 0309",
        shortName: "Grok 4.20",
        shortDescription:
            "xAI's previous generation model meant to be xAI's first foray into flagship tier reasoning, and agentic workflows.",
        description:
            "xAI's previous generation model meant to be xAI's first foray into flagship tier reasoning, and agentic workflows. Excels at tool use with a 200K-token context window, and multimodal support. It stays fast by default while still letting you enable deeper reasoning when you need more deliberate analysis.",
        releaseOrder: 20250309,
        addedOn: "2026-03-26",
        adapters: [
            "i3-xai:grok-4.20-0309-non-reasoning",
            "i3-xai:grok-4.20-0309-reasoning",
            "xai:grok-4.20-0309-non-reasoning",
            "xai:grok-4.20-0309-reasoning",
            "openrouter:x-ai/grok-4.20"
        ],
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        customIcon: "xai"
    }
]
