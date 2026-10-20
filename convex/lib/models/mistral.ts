import type { RegistryKey, SharedModel } from "./types"

const openRouterTextAdapters = (modelId: string): RegistryKey[] => [`openrouter:${modelId}`]

export const MISTRAL_MODELS: SharedModel[] = [
    {
        id: "mistral-large-4",
        name: "Mistral Large 4",
        addedOn: "2026-10-06",
        shortName: "Mistral Large 4",
        shortDescription:
            "Preview of Mistral's trillion-parameter flagship with vision and a million-token context",
        description:
            "Mistral Large 4 is a public preview of Mistral AI's new flagship, a mixture-of-experts model of about 1.05T parameters with roughly 50B active per token and a dedicated vision encoder. It reasons by default, reads images, and holds a million-token context, which suits long-document analysis, multilingual writing, and work across large codebases.",
        releaseOrder: 20261006,
        artificialAnalysis: {
            type: "llm",
            slug: "mistral-large-4"
        },
        adapters: openRouterTextAdapters("mistralai/mistral-large-4-0"),
        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
        contextLength: 1_048_576,
        maxTokens: 262_144,
        inputUsdPer1MTokens: 0.68,
        outputUsdPer1MTokens: 2.09,
        supportsDisablingReasoning: true,
        reasoningEfforts: ["off", "high"],
        defaultReasoningEffort: "high",
        developer: "Mistral AI"
    },
    {
        id: "mistral-medium-3.5",
        name: "Mistral Medium 3.5",
        addedOn: "2026-04-30",
        shortName: "Mistral Medium 3.5",
        shortDescription:
            "Dense 128B Mistral model that merges its reasoning and coding lines into one",
        description:
            "Mistral Medium 3.5 is a dense 128B open-weight model from Mistral AI and its first to merge the Magistral reasoning line and Devstral coding line into one set of weights. It reasons by default, reads images and PDFs, and keeps a 256K context, which suits code review, document-heavy analysis, and sessions that move between planning and implementation.",
        releaseOrder: 20260430,
        artificialAnalysis: {
            type: "llm",
            slug: "mistral-medium-3-5"
        },
        adapters: openRouterTextAdapters("mistralai/mistral-medium-3-5"),
        abilities: ["reasoning", "vision", "function_calling", "native_pdf", "effort_control"],
        contextLength: 262_144,
        maxTokens: 209_715,
        inputUsdPer1MTokens: 1.5,
        outputUsdPer1MTokens: 7.5,
        supportsDisablingReasoning: true,
        reasoningEfforts: ["off", "high"],
        defaultReasoningEffort: "high",
        developer: "Mistral AI"
    },
    {
        id: "mistral-small-4",
        name: "Mistral Small 4",
        addedOn: "2026-03-16",
        shortName: "Mistral Small 4",
        shortDescription:
            "Fast Mistral mixture-of-experts model with vision that reasons only when asked",
        description:
            "Mistral Small 4 is a 119B-parameter mixture-of-experts model from Mistral AI with about 6B active per token, released under Apache 2.0. It folds Mistral's reasoning, vision, and coding models into one, answers directly by default, and reasons when switched on. It suits quick everyday chat, questions about images, and high-volume coding help where latency matters.",
        releaseOrder: 20260316,
        artificialAnalysis: {
            type: "llm",
            slug: "mistral-small-4"
        },
        adapters: openRouterTextAdapters("mistralai/mistral-small-2603"),
        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
        contextLength: 262_144,
        maxTokens: 209_715,
        inputUsdPer1MTokens: 0.15,
        outputUsdPer1MTokens: 0.6,
        supportsDisablingReasoning: true,
        reasoningEfforts: ["off", "high"],
        defaultReasoningEffort: "off",
        developer: "Mistral AI"
    }
]
