import type { SharedModel } from "../types"
import { type FalImageDescriptor, SETTLES_AFTER_SAFETY_REJECTION } from "./types"

const falImageAdapters = (endpoint: string): SharedModel["adapters"] => [`fal:${endpoint}`]

const GROK_IMAGE_SIZES = [
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
    "3:2",
    "2:3",
    "2:1",
    "1:2",
    "19.5:9",
    "9:19.5",
    "20:9",
    "9:20"
] satisfies SharedModel["supportedImageSizes"]

export const FAL_XAI_IMAGE_MODELS: SharedModel[] = [
    {
        id: "grok-imagine-image-2",
        name: "Grok Imagine 2.0",
        addedOn: "2026-11-04",
        shortName: "Imagine 2.0",
        releaseOrder: 20260807,
        adapters: falImageAdapters("xai/grok-imagine-image/v2.0/text-to-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 10,
        supportsReferenceImages: true,
        maxReferenceImages: 5,
        customIcon: "xai",
        supportedImageSizes: [...GROK_IMAGE_SIZES, "21:9"],
        supportedImageResolutions: ["1K", "2K"],
        supportedImageQualities: ["low", "medium"],
        defaultImageQuality: "medium",
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByQualityAndResolution: {
                low: { "1K": 0.04, "2K": 0.06 },
                medium: { "1K": 0.06, "2K": 0.08 }
            },
            usdPerReferenceImage: 0.01
        }
    },
    {
        id: "grok-imagine-image-pro",
        name: "Grok Imagine Image Pro",
        addedOn: "2026-05-06",
        shortName: "Imagine Pro",
        releaseOrder: 20260402,
        adapters: falImageAdapters("xai/grok-imagine-image/quality/text-to-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 10,
        supportsReferenceImages: true,
        maxReferenceImages: 3,
        customIcon: "xai",
        supportedImageSizes: [...GROK_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByResolution: { "1K": 0.05, "2K": 0.07 },
            usdPerReferenceImage: 0.01
        },
        legacy: true,
        // xAI retired grok-imagine-image-quality on this date; the slug now serves 2.0 at low quality.
        sunsetOn: "2026-11-02",
        replacementId: "grok-imagine-image-2"
    },
    {
        id: "grok-imagine-image",
        name: "Grok Imagine Image",
        addedOn: "2026-01-28",
        shortName: "Imagine",
        releaseOrder: 20260401,
        adapters: falImageAdapters("xai/grok-imagine-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 10,
        supportsReferenceImages: true,
        maxReferenceImages: 3,
        customIcon: "xai",
        supportedImageSizes: [...GROK_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K"],
        imagePricing: {
            source: "fal",
            kind: "fixed",
            usdPerImageByResolution: { "1K": 0.02, "2K": 0.02 },
            usdPerReferenceImage: 0.002
        },
        legacy: true,
        replacementId: "grok-imagine-image-2"
    }
]

export const FAL_XAI_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
    {
        appModelId: "grok-imagine-image-2",
        endpoint: "xai/grok-imagine-image/v2.0/text-to-image",
        editEndpoint: "xai/grok-imagine-image/v2.0/edit",
        supportsReferences: true,
        usesAspectRatio: true,
        resolutionMode: "lowercase",
        usesQuality: true,
        defaultQuality: "medium",
        ...SETTLES_AFTER_SAFETY_REJECTION,
        safety: {}
    },
    {
        appModelId: "grok-imagine-image",
        endpoint: "xai/grok-imagine-image",
        editEndpoint: "xai/grok-imagine-image/edit",
        supportsReferences: true,
        usesAspectRatio: true,
        resolutionMode: "lowercase",
        ...SETTLES_AFTER_SAFETY_REJECTION,
        safety: {}
    },
    {
        appModelId: "grok-imagine-image-pro",
        endpoint: "xai/grok-imagine-image/quality/text-to-image",
        editEndpoint: "xai/grok-imagine-image/quality/edit",
        supportsReferences: true,
        usesAspectRatio: true,
        resolutionMode: "lowercase",
        ...SETTLES_AFTER_SAFETY_REJECTION,
        safety: {}
    }
]
