import { parseImageSizeInput } from "@/lib/image-aspect-ratios"
import type { SharedModel } from "../types"
import {
    FAL_BLACK_FOREST_LABS_IMAGE_DESCRIPTORS,
    FAL_BLACK_FOREST_LABS_IMAGE_MODELS
} from "./black_forest_labs"
import { FAL_BYTEDANCE_IMAGE_DESCRIPTORS, FAL_BYTEDANCE_IMAGE_MODELS } from "./bytedance"
import { FAL_GOOGLE_IMAGE_DESCRIPTORS, FAL_GOOGLE_IMAGE_MODELS } from "./google"
import { FAL_OPENAI_IMAGE_DESCRIPTORS, FAL_OPENAI_IMAGE_MODELS } from "./openai"
import { type ImageSizeResolution, parseImageResolution, resolveImageSize } from "./sizing"
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

export const doesFalModelSettleAfterSafetyRejection = (appModelId: string) =>
    getFalImageDescriptor(appModelId)?.settlesAfterSafetyRejection === true

/**
 * Resolves a size string for a model. Returns undefined for models without a fal endpoint,
 * which have no size rules to apply.
 */
export const resolveImageSizeForModel = ({
    model,
    size,
    resolution,
    referenceCount = 0
}: {
    model: SharedModel
    size: string
    resolution: string | undefined
    referenceCount?: number
}): ImageSizeResolution | undefined => {
    const descriptor = getFalImageDescriptor(model.id)
    if (!descriptor) return undefined
    const spec = parseImageSizeInput(size)
    if (!spec) return { ok: false, reason: "Use a ratio like 3:4 or a size like 2400x3392." }
    return resolveImageSize({
        sizing: descriptor.sizing,
        supportedSizes: model.supportedImageSizes,
        spec,
        resolution: parseImageResolution(resolution),
        referenceCount
    })
}

export {
    FAL_IMAGE_SAFETY_MESSAGE,
    buildFalImageInput,
    getFalEndpointForRequest,
    isFalImageSafetyReason,
    normalizeFalImageErrorMessage,
    parseFalImagePayload
} from "./shared"
export { describeImageSizeFailure } from "./sizing"
export type { ImageSizeResolution, ResolvedImageSize } from "./sizing"
export type {
    FalGeneratedImage,
    FalImageDescriptor,
    FalImageParseResult,
    FalImageRequest,
    FalReferenceImage,
    FalSafetyMode
} from "./types"
export { SETTLES_AFTER_SAFETY_REJECTION } from "./types"
