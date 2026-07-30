import type { RegistryKey, SharedModel } from "../types"
import type { FalImageDescriptor } from "./types"

const falImageAdapters = (endpoint: string) => [`fal:${endpoint}`] satisfies RegistryKey[]

const GPT_IMAGE_2_SIZES = [
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
    "21:9"
] satisfies SharedModel["supportedImageSizes"]

export const FAL_OPENAI_IMAGE_MODELS: SharedModel[] = [
    {
        id: "gpt-5.4-image-2",
        name: "GPT Image 2",
        addedOn: "2026-04-21",
        shortName: "GPT Image 2",
        releaseOrder: 20261023,
        adapters: falImageAdapters("openai/gpt-image-2"),
        abilities: [],
        mode: "image",
        maxPerMessage: 10,
        supportsReferenceImages: true,
        customIcon: "openai",
        supportedImageSizes: [...GPT_IMAGE_2_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        defaultImageQuality: "medium",
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByQualityAndResolution: {
                low: { "1K": 0.006, "2K": 0.007, "4K": 0.012 },
                medium: { "1K": 0.053, "2K": 0.056, "4K": 0.101 },
                high: { "1K": 0.211, "2K": 0.222, "4K": 0.401 }
            },
            usdPerReferenceImageByQuality: {
                low: 0.009,
                medium: 0.008,
                high: 0.008
            }
        }
    },
    {
        id: "gpt-5-image-mini",
        name: "GPT Image Mini",
        shortName: "GPT Image Mini",
        releaseOrder: 20261016,
        adapters: falImageAdapters("fal-ai/gpt-image-1-mini"),
        abilities: [],
        mode: "image",
        maxPerMessage: 2,
        openrouterImageModalities: ["image", "text"],
        customIcon: "openai",
        supportedImageSizes: ["1024x1024", "1536x1024", "1024x1536", "16:9", "9:16"],
        defaultImageQuality: "auto",
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByQualityAndResolution: {
                auto: { "1K": 0.005 },
                low: { "1K": 0.005 },
                medium: { "1K": 0.011 },
                high: { "1K": 0.036 }
            },
            usdPerImageByQualityAndSize: {
                auto: { "1024x1024": 0.005, "1536x1024": 0.006, "1024x1536": 0.006 },
                low: { "1024x1024": 0.005, "1536x1024": 0.006, "1024x1536": 0.006 },
                medium: { "1024x1024": 0.011, "1536x1024": 0.015, "1024x1536": 0.015 },
                high: { "1024x1024": 0.036, "1536x1024": 0.052, "1024x1536": 0.052 }
            },
            roundRequestUsdUpTo: 0.01
        },
        legacy: true,
        replacementId: "gpt-5.4-image-2"
    },
    {
        id: "gpt-5-image",
        name: "GPT Image",
        shortName: "GPT Image",
        releaseOrder: 20261015,
        adapters: falImageAdapters("fal-ai/gpt-image-1.5"),
        abilities: [],
        mode: "image",
        maxPerMessage: 2,
        openrouterImageModalities: ["image", "text"],
        customIcon: "openai",
        supportedImageSizes: ["1024x1024", "1536x1024", "1024x1536", "16:9", "9:16"],
        defaultImageQuality: "high",
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByQualityAndResolution: {
                low: { "1K": 0.009 },
                medium: { "1K": 0.034 },
                high: { "1K": 0.133 }
            },
            usdPerImageByQualityAndSize: {
                low: { "1024x1024": 0.009, "1536x1024": 0.013, "1024x1536": 0.013 },
                medium: { "1024x1024": 0.034, "1536x1024": 0.05, "1024x1536": 0.051 },
                high: { "1024x1024": 0.133, "1536x1024": 0.199, "1024x1536": 0.2 }
            }
        },
        legacy: true,
        replacementId: "gpt-5.4-image-2"
    }
]

export const FAL_OPENAI_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
    {
        appModelId: "gpt-5.4-image-2",
        endpoint: "openai/gpt-image-2",
        editEndpoint: "openai/gpt-image-2/edit",
        supportsReferences: true,
        imageSizeMode: "standard",
        usesQuality: true,
        defaultQuality: "medium",
        safety: {
            enableSafetyChecker: false
        }
    },
    {
        appModelId: "gpt-5-image-mini",
        endpoint: "fal-ai/gpt-image-1-mini",
        editEndpoint: "fal-ai/gpt-image-1-mini/edit",
        supportsReferences: true,
        imageSizeMode: "legacyOpenAi",
        usesQuality: true,
        defaultQuality: "auto",
        safety: {}
    },
    {
        appModelId: "gpt-5-image",
        endpoint: "fal-ai/gpt-image-1.5",
        editEndpoint: "fal-ai/gpt-image-1.5/edit",
        supportsReferences: true,
        imageSizeMode: "legacyOpenAi",
        usesQuality: true,
        defaultQuality: "high",
        safety: {}
    }
]
