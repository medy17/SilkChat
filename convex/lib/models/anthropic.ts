import type { RegistryKey, SharedModel } from "./types"

const anthropicTextAdapters = (modelId: string): RegistryKey[] => {
    // Anthropic uses hyphenated version numbers while OpenRouter's canonical
    // slugs use a decimal point for versioned Claude releases.
    const openRouterModelId = modelId.replace(/-(\d)-(\d)$/, "-$1.$2")

    return [
        `i3-anthropic:${modelId}`,
        `anthropic:${modelId}`,
        `openrouter:anthropic/${openRouterModelId}`
    ]
}

export const ANTHROPIC_MODELS: SharedModel[] = [
    {
        id: "claude-fable-5.1",
        name: "Claude Fable 5.1",
        addedOn: "2026-09-01",
        shortName: "Fable 5.1",
        shortDescription:
            "Anthropic's latest Mythos class model for unattended codebase work, scientific research, and polished documents, spreadsheets, and slides",
        description:
            "Claude Fable 5.1 is Anthropic's true frontier level Mythos model. It resists shortcuts, traces failures to root causes, writes tests, visually checks its work, and recovers from failed tool steps—suited to unattended codebase changes, scientific research, documents, spreadsheets, and slide decks. No task is too complex for Fable 5.1",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm"
        },
        releaseOrder: 20260901,
        adapters: anthropicTextAdapters("claude-fable-5-1"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        knowledgeCutoff: "2026-06-30",
        contextLength: 1_000_000,
        maxTokens: 128_000,
        inputUsdPer1MTokens: 10,
        outputUsdPer1MTokens: 50,
        supportsDisablingReasoning: false,
        reasoningEfforts: ["low", "medium", "high"],
        defaultReasoningEffort: "high"
    },
    {
        id: "claude-opus-5",
        name: "Claude Opus 5",
        addedOn: "2026-07-24",
        shortName: "Opus 5",
        shortDescription: "Premium Claude model for serious coding and knowledge work",
        description:
            "Claude Opus 5 is Anthropic's premium model for production-ready coding, sophisticated agents, and complex knowledge work. It plans and verifies long-running work more reliably than previous Opus models while offering effort control for balancing capability and cost.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm",
            slug: "claude-opus-5"
        },
        releaseOrder: 20260724,
        adapters: anthropicTextAdapters("claude-opus-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_000_000,
        maxTokens: 128_000,
        supportsDisablingReasoning: true
    },
    {
        id: "claude-fable-5",
        name: "Claude Fable 5",
        addedOn: "2026-06-09",
        shortName: "Fable 5",
        shortDescription:
            "Previous Mythos-class Claude for days-long coding and knowledge work with verification and self-correction",
        description:
            "Claude Fable 5 introduced Anthropic's fifth model generation as the first generally available Mythos-class release. It was designed for days-long, complex, asynchronous coding and knowledge work, sustaining ambiguous tasks through tool use, verification, and self-correction loops. Its broader cyber and biology safeguards can refuse innocuous requests.",
        developer: "Anthropic",
        artificialAnalysis: {
            type: "llm"
        },
        releaseOrder: 20260609,
        adapters: anthropicTextAdapters("claude-fable-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_000_000,
        supportsDisablingReasoning: true
    },
    {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        addedOn: "2026-06-30",
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
        addedOn: "2026-05-28",
        shortName: "Opus 4.8",
        shortDescription: "Previous-generation Opus model for complex reasoning and agentic work",
        description:
            "Claude Opus 4.8 is Anthropic's previous-generation premium model for complex reasoning, long-horizon agentic coding, and high-autonomy professional work. It remains a capable Claude 4 option for demanding tasks that do not require the newer Opus 5 generation.",
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
        shortDescription:
            "Meticulous Claude for coding marathons, computer use, and difficult tradeoffs",
        description:
            "Claude Opus 4.5 is a patient, high-end problem solver that excels at complex codebases, long-running agents, computer use, and research-heavy knowledge work. It is particularly good when the brief is ambiguous and the right answer depends on noticing the tradeoffs hiding between the lines.",
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
        addedOn: "2025-10-15",
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
        shortDescription:
            "A disciplined coding partner for agents, analysis, and everyday professional work",
        description:
            "Claude Sonnet 4.5 is a focused all-rounder with strong coding, reasoning, and tool-use instincts. It balances the steadiness needed for autonomous engineering with the clear writing and careful instruction-following that made Sonnet a favorite for daily work.",
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
        shortDescription:
            "Precise Claude for deep research and surgical changes to large codebases",
        description:
            "Claude Opus 4.1 refined Opus 4 with a sharper eye for agentic search, detailed analysis, and multi-file refactors. It has a welcome tendency to find the exact correction a large codebase needs without redecorating every room on the way out.",
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
        shortDescription: "Deep-thinking Claude built to stay with hard problems for the long haul",
        description:
            "Claude Opus 4 is the original Claude 4 heavyweight, built for sustained coding, advanced reasoning, and agents that must keep working through complex tasks. Its hybrid thinking and tool use made it a formidable choice for problems too knotted for a quick reply.",
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
        shortDescription:
            "Balanced hybrid reasoner with strong coding and unusually obedient tool use",
        description:
            "Claude Sonnet 4 brought Claude 4's hybrid reasoning, parallel tools, and stronger memory habits to the practical Sonnet tier. It is a crisp, capable coding and analysis partner that follows the brief closely without charging Opus rent.",
        releaseOrder: 20250522,
        adapters: anthropicTextAdapters("claude-sonnet-4"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true,
        sunsetOn: "2026-06-15",
        replacementId: "claude-sonnet-5"
    }
]
