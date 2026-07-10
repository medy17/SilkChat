import type { RegistryKey, SharedModel } from "./types"

const openAiTextAdapters = (modelId: string): RegistryKey[] => [
    `i3-openai:${modelId}`,
    `openai:${modelId}`,
    `openrouter:openai/${modelId}`
]

const FREE_ACCESS = {
    availableToPickFor: "free"
} satisfies Pick<SharedModel, "availableToPickFor">

const FREE_WITHOUT_REASONING_ACCESS = {
    availableToPickFor: "free",
    availableToPickForReasoningEfforts: {
        low: "pro",
        medium: "pro",
        high: "pro"
    }
} satisfies Pick<SharedModel, "availableToPickFor" | "availableToPickForReasoningEfforts">

export const OPENAI_MODELS: SharedModel[] = [
    {
        id: "gpt-5.6-sol",
        name: "GPT 5.6 Sol",
        shortName: "5.6 Sol",
        shortDescription: "Flagship GPT-5.6 model for complex reasoning, coding, and agents",
        description:
            "GPT 5.6 Sol is the flagship GPT-5.6 model, built for complex reasoning, coding, multimodal input, tool use, and long-horizon agentic workflows.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-6-sol"
        },
        releaseOrder: 20261026,
        adapters: openAiTextAdapters("gpt-5.6-sol"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro"
    },
    {
        id: "gpt-5.6-terra",
        name: "GPT 5.6 Terra",
        shortName: "5.6 Terra",
        shortDescription: "Balanced GPT-5.6 model for everyday coding, reasoning, and agents",
        description:
            "GPT 5.6 Terra is the balanced GPT-5.6 model, positioned for everyday coding, reasoning, multimodal input, tool use, and agentic tasks where capability and cost both matter.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-6-terra"
        },
        releaseOrder: 20261025,
        adapters: openAiTextAdapters("gpt-5.6-terra"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro"
    },
    {
        id: "gpt-5.6-luna",
        name: "GPT 5.6 Luna",
        shortName: "5.6 Luna",
        shortDescription: "Fast, cost-efficient GPT-5.6 model for high-volume workflows",
        description:
            "GPT 5.6 Luna is the fast, cost-efficient GPT-5.6 model, suited for high-volume chat, classification, lightweight agentic workflows, multimodal input, and tool use.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-6-luna"
        },
        releaseOrder: 20261024,
        adapters: openAiTextAdapters("gpt-5.6-luna"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro"
    },
    {
        id: "gpt-5.5",
        name: "GPT 5.5",
        shortName: "5.5",
        shortDescription: "Premium OpenAI model for high-quality chat, multimodal input, and tools",
        description:
            "GPT 5.5 is a premium OpenAI model for high-quality chat, multimodal input, and tool use. It remains capable and token-efficient, with GPT 5.6 Sol now occupying the flagship tier.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-5"
        },
        releaseOrder: 20261023,
        adapters: openAiTextAdapters("gpt-5.5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro"
    },
    {
        id: "gpt-5.4-nano",
        name: "GPT 5.4 nano",
        shortName: "5.4 nano",
        shortDescription: "Smallest GPT-5.4 variant for fast, low-cost text and tool use",
        description:
            "GPT 5.4 nano is the lightest GPT-5.4 model, tuned for low-latency chat, lightweight automations, and high-volume workloads where speed and cost matter more than deep reasoning depth.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-4-nano"
        },
        releaseOrder: 20261022,
        adapters: openAiTextAdapters("gpt-5.4-nano"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gpt-5.4-mini",
        name: "GPT 5.4 mini",
        shortName: "5.4 mini",
        shortDescription: "Balanced GPT-5.4 model for everyday chat, search, and tool use",
        description:
            "GPT 5.4 mini balances quality, speed, and cost for everyday assistant workflows. It is a practical default when you want strong multimodal and tool-calling support without paying for the largest GPT-5.4 tier.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-4-mini"
        },
        releaseOrder: 20261021,
        adapters: openAiTextAdapters("gpt-5.4-mini"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gpt-5.4",
        name: "GPT 5.4",
        shortName: "5.4",
        shortDescription: "Fast OpenAI model for everyday chat and tools",
        description:
            "GPT 5.4 is a fast flagship-style OpenAI model aimed at high-quality chat, multimodal input, and tool use. It works well as a strong default when you want broad capability without switching into a more specialized reasoning-first model.",
        developer: "OpenAI",
        artificialAnalysis: {
            type: "llm",
            slug: "gpt-5-4"
        },
        releaseOrder: 20261020,
        adapters: openAiTextAdapters("gpt-5.4"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro",
        legacy: true
    },
    {
        id: "gpt-5.3",
        name: "GPT 5.3",
        shortName: "5.3",
        releaseOrder: 20261019,
        adapters: openAiTextAdapters("gpt-5.3"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro",
        legacy: true,
        sunsetOn: "2026-08-10",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5.2",
        name: "GPT 5.2",
        shortName: "5.2",
        releaseOrder: 20261018,
        adapters: openAiTextAdapters("gpt-5.2"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro",
        legacy: true,
        sunsetOn: "2026-08-10",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5.1",
        name: "GPT 5.1",
        shortName: "5.1",
        releaseOrder: 20261017,
        adapters: openAiTextAdapters("gpt-5.1"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro",
        legacy: true,
        sunsetOn: "2026-07-23",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5",
        name: "GPT 5",
        shortName: "5",
        releaseOrder: 20261014,
        adapters: openAiTextAdapters("gpt-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        prototypeCreditTierWithReasoning: "pro",
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-5-mini",
        name: "GPT 5 mini",
        shortName: "5 mini",
        releaseOrder: 20261013,
        adapters: openAiTextAdapters("gpt-5-mini"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.4-mini"
    },
    {
        id: "gpt-5-nano",
        name: "GPT 5 nano",
        shortName: "5 nano",
        releaseOrder: 20261012,
        adapters: openAiTextAdapters("gpt-5-nano"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        ...FREE_WITHOUT_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.4-nano"
    },
    {
        id: "o4-mini-high",
        name: "o4 mini high",
        shortName: "o4 mini high",
        releaseOrder: 20261011,
        adapters: openAiTextAdapters("o4-mini-high"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf"],
        prototypeCreditTier: "pro",
        legacy: true
    },
    {
        id: "o3",
        name: "o3",
        shortName: "o3",
        releaseOrder: 20261010,
        adapters: openAiTextAdapters("o3"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-12-11",
        replacementId: "gpt-5.5"
    },
    {
        id: "o4-mini",
        name: "o4 mini",
        shortName: "o4 mini",
        releaseOrder: 20261009,
        adapters: openAiTextAdapters("o4-mini"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-10-23",
        replacementId: "gpt-5.4-mini"
    },
    {
        id: "gpt-4.1",
        name: "GPT 4.1",
        shortName: "4.1",
        releaseOrder: 20261008,
        adapters: openAiTextAdapters("gpt-4.1"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gpt-4.1-mini",
        name: "GPT 4.1 mini",
        shortName: "4.1 mini",
        releaseOrder: 20261007,
        adapters: openAiTextAdapters("gpt-4.1-mini"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gpt-4.1-nano",
        name: "GPT 4.1 nano",
        shortName: "4.1 nano",
        releaseOrder: 20261006,
        adapters: openAiTextAdapters("gpt-4.1-nano"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-10-23",
        replacementId: "gpt-5.4-nano"
    },
    {
        id: "gpt-4.5-preview",
        name: "GPT 4.5 Preview",
        shortName: "4.5 Preview",
        releaseOrder: 20261005,
        adapters: openAiTextAdapters("gpt-4.5-preview"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2025-07-14",
        replacementId: "gpt-4.1"
    },
    {
        id: "o3-mini-high",
        name: "o3 mini high",
        shortName: "o3 mini high",
        releaseOrder: 20261004,
        adapters: openAiTextAdapters("o3-mini-high"),
        abilities: ["reasoning", "function_calling"],
        prototypeCreditTier: "pro",
        legacy: true
    },
    {
        id: "o3-mini",
        name: "o3 mini",
        shortName: "o3 mini",
        releaseOrder: 20261003,
        adapters: openAiTextAdapters("o3-mini"),
        abilities: ["reasoning", "function_calling", "effort_control"],
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-10-23",
        replacementId: "gpt-5.5"
    },
    {
        id: "gpt-4o",
        name: "GPT 4o",
        shortName: "4o",
        releaseOrder: 20261001,
        adapters: openAiTextAdapters("gpt-4o"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gpt-4o-mini",
        name: "GPT 4o mini",
        shortName: "4o mini",
        releaseOrder: 20261002,
        adapters: openAiTextAdapters("gpt-4o-mini"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true
    }
]
