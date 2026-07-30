import type { RegistryKey, SharedModel } from "../types"
import type { FalImageDescriptor } from "./types"

const falImageAdapters = (endpoint: string) => [`fal:${endpoint}`] satisfies RegistryKey[]

const SEEDREAM_IMAGE_SIZES = [
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
] satisfies SharedModel["supportedImageSizes"]

export const FAL_BYTEDANCE_IMAGE_MODELS: SharedModel[] = [
    {
        id: "seedream-5-pro",
        name: "Seedream 5 Pro",
        addedOn: "2026-07-21",
        shortName: "Seedream 5 Pro",
        releaseOrder: 20260721,
        adapters: falImageAdapters("bytedance/seedream/v5/pro/text-to-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        maxReferenceImages: 10,
        openrouterImageModalities: ["image"],
        supportedImageSizes: [...SEEDREAM_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByResolution: {
                "1K": 0.0675,
                "2K": 0.135
            },
            usdPerReferenceImage: 0.0045,
            freeReferenceImages: 1
        }
    },
    {
        id: "seedream-5-lite",
        name: "Seedream 5 Lite",
        shortName: "Seedream 5 Lite",
        releaseOrder: 20260331,
        adapters: falImageAdapters("fal-ai/bytedance/seedream/v5/lite/text-to-image"),
        abilities: [],
        mode: "image",
        availableToPickFor: "free",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        maxReferenceImages: 10,
        openrouterImageModalities: ["image"],
        supportedImageSizes: [...SEEDREAM_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImage: 0.035
        }
    },
    {
        id: "seedream-4-5",
        name: "Seedream 4.5",
        addedOn: "2025-12-03",
        shortName: "Seedream 4.5",
        releaseOrder: 20260330,
        legacy: true,
        replacementId: "seedream-5-pro",
        adapters: falImageAdapters("fal-ai/bytedance/seedream/v4.5/text-to-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        maxReferenceImages: 10,
        openrouterImageModalities: ["image"],
        supportedImageSizes: [...SEEDREAM_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImage: 0.04
        }
    },
    {
        id: "seedream-4",
        name: "Seedream 4",
        shortName: "Seedream 4",
        releaseOrder: 20260329,
        legacy: true,
        replacementId: "seedream-5-pro",
        adapters: falImageAdapters("fal-ai/bytedance/seedream/v4/text-to-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        maxReferenceImages: 10,
        openrouterImageModalities: ["image"],
        supportedImageSizes: [...SEEDREAM_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImage: 0.03
        }
    }
]

export const FAL_BYTEDANCE_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
    {
        appModelId: "seedream-5-pro",
        endpoint: "bytedance/seedream/v5/pro/text-to-image",
        editEndpoint: "bytedance/seedream/v5/pro/edit",
        supportsReferences: true,
        imageSizeMode: "seedreamPro",
        omitOutputFormat: true,
        safety: {
            enableSafetyChecker: false
        }
    },
    {
        appModelId: "seedream-5-lite",
        endpoint: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
        editEndpoint: "fal-ai/bytedance/seedream/v5/lite/edit",
        supportsReferences: true,
        imageSizeMode: "seedream",
        usesMaxImages: true,
        omitOutputFormat: true,
        safety: {
            enableSafetyChecker: false
        }
    },
    {
        appModelId: "seedream-4-5",
        endpoint: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        editEndpoint: "fal-ai/bytedance/seedream/v4.5/edit",
        supportsReferences: true,
        imageSizeMode: "seedream",
        usesMaxImages: true,
        omitOutputFormat: true,
        safety: {
            enableSafetyChecker: false
        }
    },
    {
        appModelId: "seedream-4",
        endpoint: "fal-ai/bytedance/seedream/v4/text-to-image",
        editEndpoint: "fal-ai/bytedance/seedream/v4/edit",
        supportsReferences: true,
        imageSizeMode: "seedream",
        usesMaxImages: true,
        omitOutputFormat: true,
        safety: {
            enableSafetyChecker: false
        }
    }
]
