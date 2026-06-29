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
        defaultImageQuality: "low",
        prototypeCreditTier: "pro"
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
        prototypeCreditTier: "pro",
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
        prototypeCreditTier: "pro",
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
        defaultQuality: "low",
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
