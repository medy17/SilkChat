import type { RegistryKey, SharedModel } from "./types"

const googleTextAdapters = (modelId: string): RegistryKey[] => [
    `i3-google:${modelId}`,
    `google:${modelId}`,
    `openrouter:google/${modelId}`
]

const FREE_ACCESS = {
    availableToPickFor: "free"
} satisfies Pick<SharedModel, "availableToPickFor">

const FREE_UP_TO_LOW_REASONING_ACCESS = {
    availableToPickFor: "free",
    availableToPickForReasoningEfforts: {
        medium: "pro",
        high: "pro"
    }
} satisfies Pick<SharedModel, "availableToPickFor" | "availableToPickForReasoningEfforts">

const GOOGLE_MINIMAL_REASONING_EFFORTS = ["minimal", "low", "medium", "high"] as const

export const GOOGLE_MODELS: SharedModel[] = [
    {
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
        shortName: "3.5 Flash",
        shortDescription:
            "High-efficiency Gemini model tuned for fast multimodal reasoning and coding",
        description:
            "Gemini 3.5 Flash is Google's high-efficiency multimodal model, designed to deliver near-Pro level coding and reasoning while keeping Flash-tier speed and cost characteristics.",
        developer: "Google",
        releaseOrder: 20260519,
        adapters: googleTextAdapters("gemini-3.5-flash"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: [...GOOGLE_MINIMAL_REASONING_EFFORTS],
        defaultReasoningEffort: "minimal",
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        prototypeCreditTier: "basic"
    },
    {
        id: "gemini-3-flash-preview",
        name: "Gemini 3 Flash",
        shortName: "3 Flash",
        shortDescription: "Lightning-fast Gemini model with strong everyday capability",
        description:
            "Gemini 3 Flash Preview is Google's fast general-purpose model for chat, search, and multimodal tasks. It emphasizes responsiveness while still supporting reasoning controls, tools, vision, and PDF workflows.",
        developer: "Google",
        artificialAnalysis: {
            type: "llm",
            slug: "gemini-3-flash"
        },
        releaseOrder: 20251217,
        adapters: googleTextAdapters("gemini-3-flash-preview"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: [...GOOGLE_MINIMAL_REASONING_EFFORTS],
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        prototypeCreditTier: "basic"
    },
    {
        id: "gemini-3.1-flash-lite",
        name: "Gemini 3.1 Flash Lite",
        shortName: "3.1 Flash Lite",
        shortDescription: "Lowest-latency Gemini 3.1 option for lightweight workloads",
        description:
            "Gemini 3.1 Flash Lite is optimized for quick everyday responses and lower-cost workloads. It is a good fit for simple assistants, short-form drafting, and fast multimodal interactions where efficiency matters most.",
        developer: "Google",
        artificialAnalysis: {
            type: "llm",
            slug: "gemini-3-1-flash-lite-preview"
        },
        releaseOrder: 20260507,
        adapters: googleTextAdapters("gemini-3.1-flash-lite"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: [...GOOGLE_MINIMAL_REASONING_EFFORTS],
        defaultReasoningEffort: "minimal",
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        prototypeCreditTier: "basic"
    },
    {
        id: "gemini-3.1-flash-lite-preview",
        name: "Gemini 3.1 Flash Lite Preview",
        shortName: "3.1 Flash Lite Preview",
        developer: "Google",
        releaseOrder: 20260303,
        adapters: googleTextAdapters("gemini-3.1-flash-lite-preview"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: [...GOOGLE_MINIMAL_REASONING_EFFORTS],
        defaultReasoningEffort: "minimal",
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-05-25",
        replacementId: "gemini-3.1-flash-lite"
    },
    {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro",
        shortName: "3.1 Pro",
        shortDescription: "Google flagship with advanced reasoning and multimodal depth",
        description:
            "Gemini 3.1 Pro Preview is Google's higher-end general model for more complex reasoning, larger multimodal contexts, and harder analysis tasks. It is the stronger choice when response quality matters more than pure speed.",
        developer: "Google",
        artificialAnalysis: {
            type: "llm",
            slug: "gemini-3-1-pro-preview"
        },
        releaseOrder: 20260219,
        adapters: googleTextAdapters("gemini-3.1-pro-preview"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        prototypeCreditTier: "pro"
    },
    {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        shortName: "2.5 Flash",
        releaseOrder: 20250617,
        adapters: googleTextAdapters("gemini-2.5-flash"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-06-17",
        replacementId: "gemini-3-flash-preview"
    },
    {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        shortName: "2.5 Flash Lite",
        releaseOrder: 20250617,
        adapters: googleTextAdapters("gemini-2.5-flash-lite"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-07-22",
        replacementId: "gemini-3.1-flash-lite"
    },
    {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        shortName: "2.5 Pro",
        releaseOrder: 20250617,
        adapters: googleTextAdapters("gemini-2.5-pro"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-06-17",
        replacementId: "gemini-3.1-pro-preview"
    },
    {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        shortName: "2.0 Flash",
        releaseOrder: 20250205,
        adapters: googleTextAdapters("gemini-2.0-flash"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-06-01",
        replacementId: "gemini-2.5-flash"
    },
    {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        shortName: "2.0 Flash Lite",
        releaseOrder: 20250205,
        adapters: googleTextAdapters("gemini-2.0-flash-lite"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        prototypeCreditTier: "basic",
        legacy: true,
        sunsetOn: "2026-06-01",
        replacementId: "gemini-2.5-flash-lite"
    },
    {
        id: "gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        shortName: "3 Pro",
        releaseOrder: 20251118,
        adapters: googleTextAdapters("gemini-3-pro-preview"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-03-09",
        replacementId: "gemini-3.1-pro-preview"
    }
]
