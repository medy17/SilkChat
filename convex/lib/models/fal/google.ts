import type { RegistryKey, SharedModel } from "../types"
import type { FalImageDescriptor } from "./types"

const falImageAdapters = (endpoint: string) => [`fal:${endpoint}`] satisfies RegistryKey[]

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
        name: "Nano Banana",
        shortName: "2.5 Flash Image",
        releaseOrder: 20250826,
        adapters: falImageAdapters("fal-ai/nano-banana"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [...GEMINI_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByResolution: { "1K": 0.039, "2K": 0.039, "4K": 0.039 }
        },
        legacy: true,
        sunsetOn: "2026-10-02",
        replacementId: "gemini-3.1-flash-image-preview"
    },
    {
        id: "gemini-3.1-flash-image-preview",
        name: "Nano Banana 2",
        addedOn: "2026-02-26",
        shortName: "3.1 Flash Image",
        artificialAnalysis: {
            type: "text-to-image",
            slug: "nano-banana-2"
        },
        releaseOrder: 20260226,
        adapters: falImageAdapters("fal-ai/nano-banana-2"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [...GEMINI_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByResolution: { "1K": 0.08, "2K": 0.12, "4K": 0.16 }
        }
    },
    {
        id: "gemini-3.1-flash-lite-image",
        name: "Nano Banana 2 Lite",
        addedOn: "2026-07-01",
        shortName: "3.1 Flash Lite",
        releaseOrder: 20260630,
        adapters: falImageAdapters("google/nano-banana-2-lite"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [...GEMINI_IMAGE_SIZES],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImage: 0.05
        }
    },
    {
        id: "gemini-3-pro-image-preview",
        name: "Nano Banana Pro",
        addedOn: "2025-11-20",
        shortName: "3 Pro Image",
        releaseOrder: 20251120,
        adapters: falImageAdapters("fal-ai/gemini-3-pro-image-preview"),
        abilities: [],
        mode: "image",
        maxPerMessage: 2,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image", "text"],
        customIcon: "google",
        supportedImageSizes: [...GEMINI_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByResolution: { "1K": 0.15, "2K": 0.15, "4K": 0.3 }
        }
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
        appModelId: "gemini-3.1-flash-lite-image",
        endpoint: "google/nano-banana-2-lite",
        editEndpoint: "google/nano-banana-2-lite/edit",
        supportsReferences: true,
        usesAspectRatio: true,
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
