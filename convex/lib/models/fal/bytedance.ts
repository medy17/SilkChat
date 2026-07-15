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
        id: "seedream-4-5",
        name: "Seedream 4.5",
        shortName: "Seedream 4.5",
        releaseOrder: 20260330,
        adapters: falImageAdapters("fal-ai/bytedance/seedream/v4.5/text-to-image"),
        abilities: [],
        mode: "image",
        maxPerMessage: 4,
        supportsReferenceImages: true,
        openrouterImageModalities: ["image"],
        supportedImageSizes: [...SEEDREAM_IMAGE_SIZES],
        supportedImageResolutions: ["1K", "2K", "4K"]
    }
]

export const FAL_BYTEDANCE_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
    {
        appModelId: "seedream-4-5",
        endpoint: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        editEndpoint: "fal-ai/bytedance/seedream/v4.5/edit",
        supportsReferences: true,
        imageSizeMode: "seedream",
        usesMaxImages: true,
        safety: {
            enableSafetyChecker: false
        }
    }
]
