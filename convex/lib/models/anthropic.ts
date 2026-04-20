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
        shortDescription: "Anthropic's balanced Claude model for real-world work",
        description:
            "Claude Sonnet 4.6 is Anthropic's balanced model for production chat, analysis, writing, and tool use. It aims to deliver strong quality without the higher cost and latency of the most premium Claude tier.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-sonnet-4-6"
        },
        releaseOrder: 20260217,
        adapters: anthropicTextAdapters("claude-sonnet-4-6"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro"
    },
    {
        id: "claude-opus-4.6",
        name: "Claude Opus 4.6",
        shortName: "Opus 4.6",
        shortDescription:
            "Previous generation SOTA Claude model for difficult reasoning and analysis",
        description:
            "Claude Opus 4.6 is Anthropic's previous generation premium reasoning model for harder research, deeper analysis, and more demanding professional tasks.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-opus-4-6"
        },
        releaseOrder: 20260205,
        adapters: anthropicTextAdapters("claude-opus-4-6"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro"
    },
    {
        id: "claude-opus-4.7",
        name: "Claude Opus 4.7",
        shortName: "Opus 4.7",
        shortDescription: "Highest-end Claude model for difficult reasoning and analysis",
        description:
            "Claude Opus 4.7 is Anthropic's premium reasoning model for harder research, deeper analysis, and more demanding professional tasks. Use it when you want maximum Claude quality and are willing to spend more for it.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-opus-4-7"
        },
        releaseOrder: 20260416,
        adapters: anthropicTextAdapters("claude-opus-4-7"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro"
    },
    {
        id: "claude-opus-4.5",
        name: "Claude Opus 4.5",
        shortName: "Opus 4.5",
        releaseOrder: 20251124,
        adapters: anthropicTextAdapters("claude-opus-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-11-24",
        replacementId: "claude-opus-4.7"
    },
    {
        id: "claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        shortName: "Haiku 4.5",
        shortDescription: "Fast Claude model for lightweight chat and drafting",
        description:
            "Claude Haiku 4.5 is the faster, lighter Claude option for quick responses, drafting, and everyday assistant use. It trades some peak depth for speed and efficiency while keeping the core Claude workflow features intact.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm"
        },
        releaseOrder: 20251015,
        adapters: anthropicTextAdapters("claude-haiku-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "basic"
    },
    {
        id: "claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        shortName: "Sonnet 4.5",
        releaseOrder: 20250929,
        adapters: anthropicTextAdapters("claude-sonnet-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-09-29",
        replacementId: "claude-sonnet-4.6"
    },
    {
        id: "claude-opus-4.1",
        name: "Claude Opus 4.1",
        shortName: "Opus 4.1",
        releaseOrder: 20250805,
        adapters: anthropicTextAdapters("claude-opus-4-1"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-08-05",
        replacementId: "claude-opus-4.7"
    },
    {
        id: "claude-opus-4",
        name: "Claude Opus 4",
        shortName: "Opus 4",
        releaseOrder: 20250522,
        adapters: anthropicTextAdapters("claude-opus-4"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-06-15",
        replacementId: "claude-opus-4.7"
    },
    {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        shortName: "Sonnet 4",
        releaseOrder: 20250522,
        adapters: anthropicTextAdapters("claude-sonnet-4"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-06-15",
        replacementId: "claude-sonnet-4.6"
    }
]
