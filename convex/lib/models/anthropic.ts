import type { RegistryKey, SharedModel } from "./types"

const anthropicTextAdapters = (modelId: string): RegistryKey[] => [
    `i3-anthropic:${modelId}`,
    `anthropic:${modelId}`,
    `openrouter:anthropic/${modelId}`
]

export const ANTHROPIC_MODELS: SharedModel[] = [
    {
        id: "claude-sonnet-4.6",
        name: "Claude Sonnet 4.6",
        shortName: "Sonnet 4.6",
        releaseOrder: 20260930,
        adapters: anthropicTextAdapters("claude-sonnet-4-6"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "claude-opus-4.6",
        name: "Claude Opus 4.6",
        shortName: "Opus 4.6",
        releaseOrder: 20260929,
        adapters: anthropicTextAdapters("claude-opus-4-6"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "claude-opus-4.5",
        name: "Claude Opus 4.5",
        shortName: "Opus 4.5",
        releaseOrder: 20260928,
        adapters: anthropicTextAdapters("claude-opus-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        shortName: "Haiku 4.5",
        releaseOrder: 20260927,
        adapters: anthropicTextAdapters("claude-haiku-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        shortName: "Sonnet 4.5",
        releaseOrder: 20260926,
        adapters: anthropicTextAdapters("claude-sonnet-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "claude-opus-4.1",
        name: "Claude Opus 4.1",
        shortName: "Opus 4.1",
        releaseOrder: 20260925,
        adapters: anthropicTextAdapters("claude-opus-4-1"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true
    },
    {
        id: "claude-opus-4",
        name: "Claude Opus 4",
        shortName: "Opus 4",
        releaseOrder: 20260924,
        adapters: anthropicTextAdapters("claude-opus-4"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true
    },
    {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        shortName: "Sonnet 4",
        releaseOrder: 20260923,
        adapters: anthropicTextAdapters("claude-sonnet-4"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true
    }
]
