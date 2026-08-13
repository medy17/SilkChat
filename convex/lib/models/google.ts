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
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash",
        addedOn: "2026-08-13",
        shortName: "3.7 Flash",
        shortDescription: "Responsive multimodal model for coding and multi-step reasoning",
        description:
            "Google's fast multimodal model for coding, tool use, and complex multi-step reasoning. It pairs responsive generation with reliable problem solving across text, images, audio, video, and files.",
        developer: "Google",
        releaseOrder: 20260813,
        adapters: googleTextAdapters("gemini-3.7-flash"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 65_536,
        inputUsdPer1MTokens: 0.375,
        outputUsdPer1MTokens: 1.875,
        reasoningEfforts: ["low", "medium", "high"],
        defaultReasoningEffort: "medium",
        ...FREE_UP_TO_LOW_REASONING_ACCESS
    },
    {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        addedOn: "2026-07-21",
        shortName: "3.6 Flash",
        shortDescription: "Fast, capable Gemini model for multimodal reasoning and coding",
        description:
            "Google's high-efficiency multimodal model for responsive reasoning, coding, and agentic workflows. Flash-tier speed with configurable thinking for workloads that need a flexible balance of capability and cost.",
        developer: "Google",
        releaseOrder: 20260721,
        adapters: googleTextAdapters("gemini-3.6-flash"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: [...GOOGLE_MINIMAL_REASONING_EFFORTS],
        defaultReasoningEffort: "minimal",
        ...FREE_UP_TO_LOW_REASONING_ACCESS
    },
    {
        id: "gemini-3.5-flash-lite",
        name: "Gemini 3.5 Flash Lite",
        addedOn: "2026-07-21",
        shortName: "3.5 Lite",
        shortDescription: "Low-latency Gemini model for efficient, high-volume workloads",
        description:
            "Google's latest lightweight multimodal model for fast, cost-efficient workloads. Best in class for high-volume assistants, extraction, classification, and agentic tasks where responsiveness matters most.",
        developer: "Google",
        releaseOrder: 20260721,
        adapters: googleTextAdapters("gemini-3.5-flash-lite"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: [...GOOGLE_MINIMAL_REASONING_EFFORTS],
        defaultReasoningEffort: "minimal",
        ...FREE_UP_TO_LOW_REASONING_ACCESS
    },
    {
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
        addedOn: "2026-05-19",
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
        ...FREE_UP_TO_LOW_REASONING_ACCESS
    },
    {
        id: "gemini-3-flash-preview",
        name: "Gemini 3 Flash",
        addedOn: "2025-12-17",
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
        ...FREE_UP_TO_LOW_REASONING_ACCESS
    },
    {
        id: "gemini-3.1-flash-lite",
        name: "Gemini 3.1 Flash Lite",
        addedOn: "2026-03-03",
        shortName: "3.1 Lite",
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
        ...FREE_UP_TO_LOW_REASONING_ACCESS
    },
    {
        id: "gemini-3.1-flash-lite-preview",
        name: "Gemini 3.1 Flash Lite Preview",
        shortName: "3.1 Lite Preview",
        shortDescription: "Early look at Google's leanest Gemini for quick multimodal work",
        description:
            "Gemini 3.1 Flash Lite Preview was the first public taste of Google's lowest-latency 3.1 model. It brought lightweight reasoning, tools, and multimodal input to high-volume jobs before graduating into the stable Flash Lite release.",
        developer: "Google",
        releaseOrder: 20260303,
        adapters: googleTextAdapters("gemini-3.1-flash-lite-preview"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        reasoningEfforts: [...GOOGLE_MINIMAL_REASONING_EFFORTS],
        defaultReasoningEffort: "minimal",
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-05-25",
        replacementId: "gemini-3.1-flash-lite"
    },
    {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro",
        addedOn: "2026-02-19",
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
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"]
    },
    {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        shortName: "2.5 Flash",
        shortDescription: "Fast hybrid thinker with enough depth for serious everyday work",
        description:
            "Gemini 2.5 Flash is the quick-footed member of Google's thinking-model family, balancing deliberate reasoning with the latency and volume expected of Flash. It is a flexible choice for code, search, tools, and multimodal prompts when Pro would be more muscle than the job needs.",
        releaseOrder: 20250617,
        adapters: googleTextAdapters("gemini-2.5-flash"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-06-17",
        replacementId: "gemini-3-flash-preview"
    },
    {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        shortName: "2.5 Lite",
        shortDescription: "Google's thriftiest 2.5 model for fast, high-volume multimodal chores",
        description:
            "Gemini 2.5 Flash Lite is built for the conveyor belt: translation, classification, extraction, and other latency-sensitive work at serious scale. It still carries a million-token context, multimodal input, tools, and adjustable thinking, so inexpensive does not have to mean bare-bones.",
        releaseOrder: 20250617,
        adapters: googleTextAdapters("gemini-2.5-flash-lite"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        ...FREE_UP_TO_LOW_REASONING_ACCESS,
        legacy: true,
        sunsetOn: "2026-07-22",
        replacementId: "gemini-3.1-flash-lite"
    },
    {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        shortName: "2.5 Pro",
        shortDescription:
            "Deep multimodal thinker with a gift for code, learning, and long context",
        description:
            "Gemini 2.5 Pro is Google's flagship thinking model for complex reasoning, ambitious coding, and rich multimodal analysis. Its million-token context and strong long-video understanding make it especially good at learning from sprawling source material before turning insight into something useful.",
        releaseOrder: 20250617,
        adapters: googleTextAdapters("gemini-2.5-pro"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        legacy: true,
        sunsetOn: "2026-06-17",
        replacementId: "gemini-3.1-pro-preview"
    },
    {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        shortName: "2.0 Flash",
        shortDescription: "Low-latency multimodal workhorse from the dawn of Gemini's agentic era",
        description:
            "Gemini 2.0 Flash is Google's efficient multimodal workhorse for high-frequency tasks, with a million-token context and a taste for tools. It helped usher Gemini into the agentic era while staying quick enough for everyday production traffic.",
        releaseOrder: 20250205,
        adapters: googleTextAdapters("gemini-2.0-flash"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true,
        sunsetOn: "2026-06-01",
        replacementId: "gemini-2.5-flash"
    },
    {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        shortName: "2.0 Lite",
        shortDescription:
            "No-frills Gemini speed for classification, captions, and work by the million",
        description:
            "Gemini 2.0 Flash Lite pares the family down for jobs where every millisecond and fraction of a cent counts. It handles multimodal input and vast batches with a million-token window, making it a cheerful little engine for captions, extraction, translation, and classification.",
        releaseOrder: 20250205,
        adapters: googleTextAdapters("gemini-2.0-flash-lite"),
        abilities: ["vision", "function_calling", "native_pdf"],
        ...FREE_ACCESS,
        legacy: true,
        sunsetOn: "2026-06-01",
        replacementId: "gemini-2.5-flash-lite"
    },
    {
        id: "gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        shortName: "3 Pro",
        shortDescription:
            "Vision-first Gemini flagship for agents, code, and spatially messy problems",
        description:
            "Gemini 3 Pro Preview pushed Google's flagship into richer visual and spatial reasoning, from dense documents and long video to screens and physical layouts. It is a powerful builder and agent model when the task calls for understanding what is on the page, where it sits, and what to do next.",
        releaseOrder: 20251118,
        adapters: googleTextAdapters("gemini-3-pro-preview"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        supportsDisablingReasoning: true,
        legacy: true,
        sunsetOn: "2026-03-09",
        replacementId: "gemini-3.1-pro-preview"
    }
]
