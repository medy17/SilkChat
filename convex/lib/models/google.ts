import type { RegistryKey, SharedModel } from "./types"

const googleTextAdapters = (modelId: string): RegistryKey[] => [
    `i3-google:${modelId}`,
    `google:${modelId}`,
    `openrouter:google/${modelId}`
]

const googleImageAdapters = (modelId: string): RegistryKey[] => [
    `i3-google:${modelId}`,
    `google:${modelId}`,
    `openrouter:google/${modelId}`
]

export const GOOGLE_MODELS: SharedModel[] = [
    {
        id: "gemini-3-flash-preview",
        name: "Gemini 3 Flash Preview",
        shortName: "3 Flash",
        shortDescription: "Lightning-fast Gemini model with strong everyday capability",
        description:
            "Gemini 3 Flash Preview is Google's fast general-purpose model for chat, search, and multimodal tasks. It emphasizes responsiveness while still supporting reasoning controls, tools, vision, and PDF workflows.",
        developer: "Google",
        artificialAnalysis: {
            type: "llm",
            slug: "gemini-3-flash"
        },
        releaseOrder: 20260922,
        adapters: googleTextAdapters("gemini-3-flash-preview"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "basic"
    },
    {
        id: "gemini-3.1-flash-lite-preview",
        name: "Gemini 3.1 Flash Lite Preview",
        shortName: "3.1 Flash Lite",
        shortDescription: "Lowest-latency Gemini 3.1 option for lightweight workloads",
        description:
            "Gemini 3.1 Flash Lite Preview is optimized for quick everyday responses and lower-cost workloads. It is a good fit for simple assistants, short-form drafting, and fast multimodal interactions where efficiency matters most.",
        developer: "Google",
        artificialAnalysis: {
            type: "llm",
            slug: "gemini-3-1-flash-lite-preview"
        },
        releaseOrder: 20260921,
        adapters: googleTextAdapters("gemini-3.1-flash-lite-preview"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "basic"
    },
    {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        shortName: "3.1 Pro",
        shortDescription: "Google flagship with advanced reasoning and multimodal depth",
        description:
            "Gemini 3.1 Pro Preview is Google's higher-end general model for more complex reasoning, larger multimodal contexts, and harder analysis tasks. It is the stronger choice when response quality matters more than pure speed.",
        developer: "Google",
        artificialAnalysis: {
            type: "llm",
            slug: "gemini-3-1-pro-preview"
        },
        releaseOrder: 20260920,
        adapters: googleTextAdapters("gemini-3.1-pro-preview"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro"
    },
    {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        shortName: "2.5 Flash",
        releaseOrder: 20260919,
        adapters: googleTextAdapters("gemini-2.5-flash"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        shortName: "2.5 Flash Lite",
        releaseOrder: 20260918,
        adapters: googleTextAdapters("gemini-2.5-flash-lite"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        shortName: "2.5 Pro",
        releaseOrder: 20260917,
        adapters: googleTextAdapters("gemini-2.5-pro"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro",
        legacy: true
    },
    {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        shortName: "2.0 Flash",
        releaseOrder: 20260916,
        adapters: googleTextAdapters("gemini-2.0-flash"),
        abilities: ["vision", "function_calling", "pdf"],
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        shortName: "2.0 Flash Lite",
        releaseOrder: 20260915,
        adapters: googleTextAdapters("gemini-2.0-flash-lite"),
        abilities: ["vision", "function_calling", "pdf"],
        prototypeCreditTier: "basic",
        legacy: true
    },
    {
        id: "gemini-3-pro-preview",
        name: "Gemini 3 Pro Preview",
        shortName: "3 Pro",
        releaseOrder: 20260914,
        adapters: googleTextAdapters("gemini-3-pro-preview"),
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"],
        supportsDisablingReasoning: true,
        prototypeCreditTier: "pro"
    },
    {
        id: "gemini-2.5-flash-image",
        name: "Gemini 2.5 Flash Image",
        shortName: "2.5 Flash Image",
        releaseOrder: 20260913,
        adapters: googleImageAdapters("gemini-2.5-flash-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"],
        supportedImageResolutions: ["1K", "2K", "4K"],
        prototypeCreditTier: "pro",
        legacy: true
    },
    {
        id: "gemini-3.1-flash-image-preview",
        name: "Gemini 3.1 Flash Image Preview",
        shortName: "3.1 Flash Image",
        artificialAnalysis: {
            type: "text-to-image",
            slug: "nano-banana-2"
        },
        releaseOrder: 20260912,
        adapters: googleImageAdapters("gemini-3.1-flash-image-preview"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"],
        supportedImageResolutions: ["1K", "2K", "4K"],
        prototypeCreditTier: "pro"
    },
    {
        id: "gemini-3-pro-image-preview",
        name: "Gemini 3 Pro Image Preview",
        shortName: "3 Pro Image",
        releaseOrder: 20260911,
        adapters: googleImageAdapters("gemini-3-pro-image-preview"),
        abilities: [],
        mode: "image",
        maxPerMessage: 2,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [
            "1:1",
            "3:2",
            "2:3",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "21:9"
        ],
        supportedImageResolutions: ["1K", "2K", "4K"],
        prototypeCreditTier: "pro"
    }
]
