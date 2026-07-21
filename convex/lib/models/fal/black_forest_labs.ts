import type { RegistryKey, SharedModel } from "../types"
import type { FalImageDescriptor } from "./types"

const falImageAdapters = (endpoint: string) => [`fal:${endpoint}`] satisfies RegistryKey[]

const FLUX_IMAGE_SIZES = [
    "1:1",
    "3:2",
    "2:3",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9"
] satisfies SharedModel["supportedImageSizes"]

export const FAL_BLACK_FOREST_LABS_IMAGE_MODELS: SharedModel[] = [
    {
        id: "flux-2-flex",
        name: "FLUX 2 Flex",
        addedOn: "2025-11-25",
        shortName: "Flux 2 Flex",
        releaseOrder: 20260331,
        adapters: falImageAdapters("fal-ai/flux-2-flex"),
        abilities: [],
        mode: "image",
        maxPerMessage: 2,
        // fal exposes flux-2-flex as text-to-image only; keep this false so the UI
        // never lets references be attached for a model the fal descriptor rejects.
        supportsReferenceImages: false,
        openrouterImageModalities: ["image"],
        customIcon: "bflabs",
        supportedImageSizes: [...FLUX_IMAGE_SIZES],
        imagePricing: {
            source: "fal",
            kind: "output_megapixel",
            usdPerOutputMegapixel: 0.05,
            minimumBillableOutputMegapixels: 1,
            roundOutputMegapixelsUp: true
        }
    }
]

export const FAL_BLACK_FOREST_LABS_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
    {
        appModelId: "flux-2-flex",
        endpoint: "fal-ai/flux-2-flex",
        supportsReferences: false,
        imageSizeMode: "standard",
        safety: {
            enableSafetyChecker: false,
            safetyTolerance: "1"
        }
    }
]
