import type { RegistryKey, SharedModel } from "../types"
import type { FalImageDescriptor } from "./types"

const googleImageAdapters = (modelId: string): RegistryKey[] => [
    `i3-google:${modelId}`,
    `google:${modelId}`,
    `openrouter:google/${modelId}`
]

const GEMINI_IMAGE_SIZES = [
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

export const FAL_GOOGLE_IMAGE_MODELS: SharedModel[] = [
    {
        id: "gemini-2.5-flash-image",
        name: "Gemini 2.5 Flash Image",
        shortName: "2.5 Flash Image",
        releaseOrder: 20250826,
        adapters: googleImageAdapters("gemini-2.5-flash-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [...GEMINI_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        prototypeCreditTier: "pro",
        legacy: true,
        sunsetOn: "2026-10-02",
        replacementId: "gemini-3.1-flash-image-preview"
    },
    {
        id: "gemini-3.1-flash-image-preview",
        name: "Gemini 3.1 Flash Image Preview",
        shortName: "3.1 Flash Image",
        artificialAnalysis: {
            type: "text-to-image",
            slug: "nano-banana-2"
        },
        releaseOrder: 20260226,
        adapters: googleImageAdapters("gemini-3.1-flash-image-preview"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [...GEMINI_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        prototypeCreditTier: "pro"
    },
    {
        id: "gemini-3-pro-image-preview",
        name: "Gemini 3 Pro Image Preview",
        shortName: "3 Pro Image",
        releaseOrder: 20251120,
        adapters: googleImageAdapters("gemini-3-pro-image-preview"),
        abilities: [],
        mode: "image",
        maxPerMessage: 2,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [...GEMINI_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        prototypeCreditTier: "pro"
    }
]

export const FAL_GOOGLE_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
    {
        appModelId: "gemini-2.5-flash-image",
        endpoint: "fal-ai/nano-banana",
        editEndpoint: "fal-ai/nano-banana/edit",
        supportsReferences: true,
        usesAspectRatio: true,
        safety: {
            safetyTolerance: "1"
        }
    },
    {
        appModelId: "gemini-3.1-flash-image-preview",
        endpoint: "fal-ai/nano-banana-2",
        editEndpoint: "fal-ai/nano-banana-2/edit",
        supportsReferences: true,
        usesAspectRatio: true,
        resolutionMode: "uppercase",
        safety: {
            safetyTolerance: "1"
        }
    },
    {
        appModelId: "gemini-3-pro-image-preview",
        endpoint: "fal-ai/gemini-3-pro-image-preview",
        editEndpoint: "fal-ai/gemini-3-pro-image-preview/edit",
        supportsReferences: true,
        usesAspectRatio: true,
        resolutionMode: "uppercase",
        safety: {
            safetyTolerance: "1"
        }
    }
]
