import type { RegistryKey, SharedModel } from "./types"

const anthropicTextAdapters = (modelId: string): RegistryKey[] => [
    `i3-anthropic:${modelId}`,
    `anthropic:${modelId}`,
    `openrouter:anthropic/${modelId}`
]

export const ANTHROPIC_MODELS: SharedModel[] = [
    {
        id: "claude-fable-5",
        name: "Claude Fable 5",
        shortName: "Fable 5",
        shortDescription:
            "Mythos-class Claude model for long-running autonomous coding and knowledge work",
        description:
            "Anthropic's Mythos-class model for autonomous knowledge work and coding. Designed for long-running, complex, asynchronous tasks that benefit from strong verification and self-correction loops.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm"
        },
        releaseOrder: 20260609,
        adapters: anthropicTextAdapters("claude-fable-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_000_000,
        supportsDisablingReasoning: true,
        requiredRole: "admin"
    },
    {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        shortName: "Sonnet 5",
        shortDescription: "Current Sonnet-class Claude model for agentic work and coding",
        description:
            "Claude Sonnet 5 is Anthropic's current Sonnet-class model for production chat, coding, analysis, tool use, and agentic workflows. It is the balanced Claude 5 generation option, with stronger capability than previous Sonnet models while staying below the cost and latency of the premium Claude tiers.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-sonnet-5"
        },
        releaseOrder: 20260630,
        adapters: anthropicTextAdapters("claude-sonnet-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_000_000,
        supportsDisablingReasoning: true
    },
    {
        id: "claude-sonnet-4.6",
        name: "Claude Sonnet 4.6",
        shortName: "Sonnet 4.6",
        shortDescription: "Previous-generation Sonnet-class Claude model for real-world work",
        description:
            "Claude Sonnet 4.6 is Anthropic's previous-generation Sonnet-class model for production chat, analysis, writing, coding, and tool use. It remains a balanced Claude 4 model for everyday professional work when you do not need the newer Claude 5 generation.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-sonnet-4-6"
        },
        releaseOrder: 20260217,
        adapters: anthropicTextAdapters("claude-sonnet-4-6"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true
    },
    {
        id: "claude-opus-4.6",
        name: "Claude Opus 4.6",
        shortName: "Opus 4.6",
        shortDescription: "Earlier high-end Claude model for difficult reasoning and analysis",
        description:
            "Claude Opus 4.6 is an earlier premium reasoning model for harder research, deeper analysis, and more demanding professional tasks.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-opus-4-6"
        },
        releaseOrder: 20260205,
        adapters: anthropicTextAdapters("claude-opus-4-6"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true
    },
    {
        id: "claude-opus-4.8",
        name: "Claude Opus 4.8",
        shortName: "Opus 4.8",
        shortDescription: "Highest-end Claude model for complex reasoning and agentic work",
        description:
            "Claude Opus 4.8 is Anthropic's most capable generally available Claude model for complex reasoning, long-horizon agentic coding, and high-autonomy professional work. Use it when you want maximum Claude quality and are willing to spend more for it.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-opus-4-8"
        },
        releaseOrder: 20260528,
        adapters: anthropicTextAdapters("claude-opus-4-8"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "claude-opus-4.7",
        name: "Claude Opus 4.7",
        shortName: "Opus 4.7",
        shortDescription: "Previous generation Claude model for difficult reasoning and analysis",
        description:
            "Claude Opus 4.7 is Anthropic's previous generation premium reasoning model for harder research, deeper analysis, and more demanding professional tasks.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-opus-4-7"
        },
        releaseOrder: 20260416,
        adapters: anthropicTextAdapters("claude-opus-4-7"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true
    },
    {
        id: "claude-opus-4.5",
        name: "Claude Opus 4.5",
        shortName: "Opus 4.5",
        releaseOrder: 20251124,
        adapters: anthropicTextAdapters("claude-opus-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true,
        sunsetOn: "2026-11-24",
        replacementId: "claude-opus-4.8"
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
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true
    },
    {
        id: "claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        shortName: "Sonnet 4.5",
        releaseOrder: 20250929,
        adapters: anthropicTextAdapters("claude-sonnet-4-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true,
        sunsetOn: "2026-09-29",
        replacementId: "claude-sonnet-5"
    },
    {
        id: "claude-opus-4.1",
        name: "Claude Opus 4.1",
        shortName: "Opus 4.1",
        releaseOrder: 20250805,
        adapters: anthropicTextAdapters("claude-opus-4-1"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true,
        sunsetOn: "2026-08-05",
        replacementId: "claude-opus-4.8"
    },
    {
        id: "claude-opus-4",
        name: "Claude Opus 4",
        shortName: "Opus 4",
        releaseOrder: 20250522,
        adapters: anthropicTextAdapters("claude-opus-4"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true,
        sunsetOn: "2026-06-15",
        replacementId: "claude-opus-4.8"
    },
    {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        shortName: "Sonnet 4",
        releaseOrder: 20250522,
        adapters: anthropicTextAdapters("claude-sonnet-4"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true,
        sunsetOn: "2026-06-15",
        replacementId: "claude-sonnet-5"
    }
]
