import type { SharedModel } from "../types"
import {
    FAL_BLACK_FOREST_LABS_IMAGE_DESCRIPTORS,
    FAL_BLACK_FOREST_LABS_IMAGE_MODELS
} from "./black_forest_labs"
import { FAL_BYTEDANCE_IMAGE_DESCRIPTORS, FAL_BYTEDANCE_IMAGE_MODELS } from "./bytedance"
import { FAL_GOOGLE_IMAGE_DESCRIPTORS, FAL_GOOGLE_IMAGE_MODELS } from "./google"
import { FAL_OPENAI_IMAGE_DESCRIPTORS, FAL_OPENAI_IMAGE_MODELS } from "./openai"
import type { FalImageDescriptor } from "./types"
import { FAL_XAI_IMAGE_DESCRIPTORS, FAL_XAI_IMAGE_MODELS } from "./xai"

export const FAL_IMAGE_MODELS: SharedModel[] = [
    ...FAL_OPENAI_IMAGE_MODELS,
    ...FAL_GOOGLE_IMAGE_MODELS,
    ...FAL_XAI_IMAGE_MODELS,
    ...FAL_BLACK_FOREST_LABS_IMAGE_MODELS,
    ...FAL_BYTEDANCE_IMAGE_MODELS
]

const FAL_IMAGE_DESCRIPTORS: FalImageDescriptor[] = [
    ...FAL_OPENAI_IMAGE_DESCRIPTORS,
    ...FAL_GOOGLE_IMAGE_DESCRIPTORS,
    ...FAL_XAI_IMAGE_DESCRIPTORS,
    ...FAL_BLACK_FOREST_LABS_IMAGE_DESCRIPTORS,
    ...FAL_BYTEDANCE_IMAGE_DESCRIPTORS
]

export const getFalImageDescriptor = (appModelId: string) =>
    FAL_IMAGE_DESCRIPTORS.find((descriptor) => descriptor.appModelId === appModelId)

export {
    buildFalImageInput,
    getFalEndpointForRequest,
    isFalImageSizeSupported,
    parseFalImagePayload
} from "./shared"
export type {
    FalGeneratedImage,
    FalImageDescriptor,
    FalImageParseResult,
    FalImageRequest,
    FalReferenceImage,
    FalSafetyMode
} from "./types"
