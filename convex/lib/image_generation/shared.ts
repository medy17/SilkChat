import type { GenericActionCtx } from "convex/server"
import { nanoid } from "nanoid"
import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import type { DataModel } from "../../_generated/dataModel"
import { r2 } from "../../attachments"
import { resolvePrototypeCreditCharge, resolveRequiredPlanForModelAccess } from "../credits"
import { MODELS_SHARED } from "../models"
import type { ImageResolution, ImageSize, SharedModel } from "../models"
import {
    type FalReferenceImage,
    getFalImageDescriptor,
    isFalImageSizeSupported
} from "../models/fal"

export const MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN = 10

export type ImageReferenceSource = {
    key: string
    source: "attachment" | "generation" | "reference_upload"
    generatedImageId?: Id<"generatedImages">
}

export type PreparedImageReference = ImageReferenceSource & {
    id: string
    label: string
    mimeType?: string
}

export type ImageCreditEstimate = {
    bucket: "basic" | "pro" | "none"
    units: number
    counted: boolean
    requiredPlan: "free" | "pro"
}

export const getSelectableImageModels = () =>
    MODELS_SHARED.filter((model) => model.mode === "image" && !model.sunsetOn)

export const getImageModelById = (modelId: string) =>
    MODELS_SHARED.find((model) => model.id === modelId && model.mode === "image")

export const getImageModelMaxPerMessage = (model: SharedModel) => model.maxPerMessage ?? 1

export const getImageModelCreditEstimate = (model: SharedModel): ImageCreditEstimate => {
    const requiredPlan = resolveRequiredPlanForModelAccess({
        reasoningEffort: "off",
        availableToPickFor: model.availableToPickFor
    })
    const creditCharge = resolvePrototypeCreditCharge({
        providerSource: "internal",
        modelMode: "image",
        enabledTools: [],
        reasoningEffort: "off",
        prototypeCreditTier: model.prototypeCreditTier,
        prototypeCreditTierWithReasoning: model.prototypeCreditTierWithReasoning
    })

    return {
        bucket: creditCharge.bucket,
        units: creditCharge.units,
        counted: creditCharge.counted,
        requiredPlan
    }
}

export const getSupportedAspectRatiosForImageModel = (model: SharedModel) => {
    const descriptor = getFalImageDescriptor(model.id)
    const supported = model.supportedImageSizes ?? []
    if (!descriptor) return supported

    return supported.filter((size) => isFalImageSizeSupported(descriptor, size))
}

export const getSupportedResolutionsForImageModel = (model: SharedModel) =>
    model.supportedImageResolutions ?? []

export const validatePreparedImageRequest = ({
    modelId,
    aspectRatio,
    resolution,
    variants,
    referenceCount
}: {
    modelId: string
    aspectRatio?: string
    resolution?: string
    variants?: number
    referenceCount: number
}) => {
    const model = getImageModelById(modelId)
    if (!model) {
        throw new Error("Image model not found.")
    }

    const descriptor = getFalImageDescriptor(model.id)
    if (!descriptor) {
        throw new Error("Image model is not available on fal.")
    }

    const selectedAspectRatio = (aspectRatio ||
        getSupportedAspectRatiosForImageModel(model)[0] ||
        "1:1") as ImageSize
    const supportedAspectRatios = getSupportedAspectRatiosForImageModel(model)
    if (
        supportedAspectRatios.length > 0 &&
        !supportedAspectRatios.includes(selectedAspectRatio) &&
        !isFalImageSizeSupported(descriptor, selectedAspectRatio)
    ) {
        throw new Error("Selected aspect ratio is not supported by this model.")
    }

    const selectedResolution = resolution as ImageResolution | undefined
    const supportedResolutions = getSupportedResolutionsForImageModel(model)
    if (
        selectedResolution &&
        supportedResolutions.length > 0 &&
        !supportedResolutions.includes(selectedResolution)
    ) {
        throw new Error("Selected resolution is not supported by this model.")
    }

    const requestedVariants = Math.max(1, Math.trunc(variants ?? 1))
    const maxVariants = Math.min(
        getImageModelMaxPerMessage(model),
        MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN
    )
    if (requestedVariants > maxVariants) {
        throw new Error(
            `This model supports up to ${maxVariants} image variant${maxVariants === 1 ? "" : "s"}.`
        )
    }

    if (referenceCount > 0 && !model.supportsReferenceImages) {
        throw new Error("Reference images are not supported by this model.")
    }
    if (typeof model.maxReferenceImages === "number" && referenceCount > model.maxReferenceImages) {
        throw new Error(`This model supports up to ${model.maxReferenceImages} reference images.`)
    }
    if (referenceCount > 0 && !descriptor.supportsReferences) {
        throw new Error("Reference images are not supported by this fal model.")
    }

    return {
        model,
        descriptor,
        aspectRatio: selectedAspectRatio,
        resolution: selectedResolution,
        variants: requestedVariants,
        creditEstimate: getImageModelCreditEstimate(model)
    }
}

export const getReferenceSourceForKey = (key: string): ImageReferenceSource["source"] | null => {
    if (key.startsWith("attachments/")) return "attachment"
    if (key.startsWith("generations/")) return "generation"
    if (key.startsWith("references/")) return "reference_upload"
    return null
}

const getMetadataString = (metadata: unknown, key: string) =>
    typeof metadata === "object" &&
    metadata !== null &&
    key in metadata &&
    typeof (metadata as Record<string, unknown>)[key] === "string"
        ? ((metadata as Record<string, unknown>)[key] as string)
        : undefined

const assertOwnedImageKey = async (
    ctx: GenericActionCtx<DataModel>,
    userId: string,
    key: string
) => {
    const source = getReferenceSourceForKey(key)
    if (!source) {
        throw new Error("Invalid reference image.")
    }

    const metadata = await r2.getMetadata(ctx, key)
    if (!metadata) {
        throw new Error("Reference image not found.")
    }

    // Fail closed: reference keys carry an `authorId` at upload time, so a missing or
    // mismatched author means we can't prove ownership and must reject.
    const authorId = getMetadataString(metadata, "authorId")
    if (authorId !== userId) {
        throw new Error("Invalid reference image.")
    }

    const contentType =
        getMetadataString(metadata, "type") ?? getMetadataString(metadata, "contentType")
    if (contentType && !contentType.startsWith("image/")) {
        throw new Error("Reference file must be an image.")
    }

    return {
        source,
        mimeType: contentType
    }
}

export const resolveFalReferenceImages = async (
    ctx: GenericActionCtx<DataModel>,
    userId: string,
    references: ImageReferenceSource[] = []
): Promise<FalReferenceImage[]> => {
    const resolved: FalReferenceImage[] = []

    for (const reference of references) {
        await assertOwnedImageKey(ctx, userId, reference.key)
        resolved.push({
            key: reference.key,
            url: await r2.getUrl(reference.key)
        })
    }

    return resolved
}

export const resolveGeneratedImageReferenceSource = async (
    ctx: GenericActionCtx<DataModel>,
    userId: string,
    generatedImageId: Id<"generatedImages">
): Promise<ImageReferenceSource> => {
    const image = await ctx.runQuery(internal.images.getGeneratedImageInternal, {
        id: generatedImageId
    })
    if (!image || image.userId !== userId) {
        throw new Error("Generated image not found.")
    }

    return {
        key: image.storageKey,
        source: "generation",
        generatedImageId
    }
}

export const createImageCreditEventKey = (source: "standalone" | "chat") =>
    `${source}-image:${nanoid()}`

// Chat image jobs encode the 1-based variant index as the suffix of their
// clientRequestId (`${cardId}:${index}`); this reads it back out.
export const getVariantIndexFromClientRequestId = (clientRequestId?: string) => {
    if (!clientRequestId) return undefined
    const separatorIndex = clientRequestId.lastIndexOf(":")
    if (separatorIndex === -1) return undefined

    const variantIndex = Number.parseInt(clientRequestId.slice(separatorIndex + 1), 10)
    return Number.isFinite(variantIndex) && variantIndex > 0 ? variantIndex : undefined
}
