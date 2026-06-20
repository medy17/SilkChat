import type { SharedModel } from "./types"

export const XAI_MODELS: SharedModel[] = [
    {
        id: "grok-4.3",
        name: "Grok 4.3",
        shortName: "Grok 4.3",
        shortDescription:
            "XAI's latest and greatest model for reasoning, vision, and function calling with effort control",
        description:
            "XAI's latest generation model with strong multimodal reasoning, tool use, and a large context window for complex conversations.",
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
            "openrouter:x-ai/grok-4.20-beta"
        ],
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        customIcon: "xai"
    }
]
