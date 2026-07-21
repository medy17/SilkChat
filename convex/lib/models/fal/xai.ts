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
        id: "grok-imagine-image-pro",
        name: "Grok Imagine Image Pro",
        addedOn: "2026-05-06",
        shortName: "Imagine Pro",
        artificialAnalysis: {
            type: "text-to-image",
            slug: "grok-imagine-image-pro"
        },
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
        }
    },
    {
        id: "grok-imagine-image",
        name: "Grok Imagine Image",
        addedOn: "2026-01-28",
        shortName: "Imagine",
        artificialAnalysis: {
            type: "text-to-image",
            slug: "grok-imagine-image"
        },
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
        }
    }
]

export const FAL_XAI_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
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
