import type { GenericActionCtx } from "convex/server"
import { nanoid } from "nanoid"
import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import type { DataModel } from "../../_generated/dataModel"
import { r2 } from "../../attachments"
import { resolveRequiredPlanForModelAccess } from "../credits"
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
    requiredPlan: "free" | "pro"
}

export const getSelectableImageModels = () =>
    MODELS_SHARED.filter((model) => model.mode === "image" && !model.sunsetOn)

export const getImageModelById = (modelId: string) =>
    MODELS_SHARED.find((model) => model.id === modelId && model.mode === "image")

export const getImageModelMaxPerMessage = (model: SharedModel) => model.maxPerMessage ?? 1

export const getImageModelCreditEstimate = (model: SharedModel): ImageCreditEstimate => {
    return {
        requiredPlan: resolveRequiredPlanForModelAccess({
            reasoningEffort: "off",
            availableToPickFor: model.availableToPickFor
        })
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

// Resolution is a magnitude axis (1K < 2K < 4K), so an out-of-range choice is clamped to
// the nearest supported rung rather than dropped to the floor: an explicit 4K request on a
// 2K-max model yields 2K (honor the "high fidelity" intent), not 1K.
const RESOLUTION_ORDER: ImageResolution[] = ["1K", "2K", "4K"]
const resolutionRank = (resolution: ImageResolution) => RESOLUTION_ORDER.indexOf(resolution)

const clampResolutionToSupported = (
    desired: ImageResolution,
    supported: ImageResolution[]
): ImageResolution => {
    if (supported.includes(desired)) return desired

    const desiredRank = resolutionRank(desired)
    const largestSupportedAtOrBelow = [...supported]
        .filter((candidate) => resolutionRank(candidate) <= desiredRank)
        .sort((a, b) => resolutionRank(b) - resolutionRank(a))[0]
    if (largestSupportedAtOrBelow) return largestSupportedAtOrBelow

    // Nothing at or below the request: fall to the smallest the model offers.
    return [...supported].sort((a, b) => resolutionRank(a) - resolutionRank(b))[0]
}

export const validatePreparedImageRequest = ({
    modelId,
    aspectRatio,
    resolution,
    variants,
    referenceCount,
    defaults
}: {
    modelId: string
    aspectRatio?: string
    resolution?: string
    variants?: number
    referenceCount: number
    // Soft per-user defaults: fill an empty field, are outranked by an explicit model
    // choice, and are themselves clamped to the model's capabilities below.
    defaults?: {
        resolution?: ImageResolution
        variants?: number
    }
}) => {
    const model = getImageModelById(modelId)
    if (!model) {
        throw new Error("Image model not found.")
    }

    const descriptor = getFalImageDescriptor(model.id)
    if (!descriptor) {
        throw new Error("Image model is not available on fal.")
    }

    // Aspect ratio, resolution, and variant count are coerced to legal values rather
    // than rejected: the model selects from a union of every model's enums, so a value
    // that's valid in general can still be illegal for the specific model picked. Since
    // this only builds a pending card the user confirms before spending credits,
    // snapping to the nearest legal value is safer than failing the card. References are
    // the exception (handled below) — silently dropping a reference would change intent.
    const supportedAspectRatios = getSupportedAspectRatiosForImageModel(model)
    const requestedAspectRatio = (aspectRatio || supportedAspectRatios[0] || "1:1") as ImageSize
    const aspectRatioSupported =
        supportedAspectRatios.length === 0 ||
        supportedAspectRatios.includes(requestedAspectRatio) ||
        isFalImageSizeSupported(descriptor, requestedAspectRatio)
    const selectedAspectRatio = aspectRatioSupported
        ? requestedAspectRatio
        : ((supportedAspectRatios[0] ?? "1:1") as ImageSize)

    const supportedResolutions = getSupportedResolutionsForImageModel(model)
    const requestedResolution = resolution as ImageResolution | undefined
    let selectedResolution: ImageResolution | undefined
    if (supportedResolutions.length === 0) {
        // Model takes no explicit resolution; leave whatever was passed (usually nothing).
        selectedResolution = requestedResolution
    } else {
        // Precedence: explicit model choice > user default > system default ("1K"). The
        // winner is then clamped to a supported rung, so every layer stays within limits.
        const desiredResolution =
            requestedResolution ?? defaults?.resolution ?? ("1K" as ImageResolution)
        selectedResolution = clampResolutionToSupported(desiredResolution, supportedResolutions)
    }

    // Same precedence for count: explicit > user default > 1, then clamp to the ceiling.
    const desiredVariants = variants ?? defaults?.variants ?? 1
    const requestedVariants = Math.max(1, Math.trunc(desiredVariants))
    const maxVariants = Math.min(
        getImageModelMaxPerMessage(model),
        MAX_TOTAL_IMAGE_GENERATIONS_PER_RUN
    )
    const selectedVariants = Math.min(requestedVariants, maxVariants)

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
        variants: selectedVariants,
        creditEstimate: getImageModelCreditEstimate(model)
    }
}

export const getReferenceSourceForKey = (key: string): ImageReferenceSource["source"] | null => {
    if (key.startsWith("attachments/")) return "attachment"
    if (key.startsWith("generations/")) return "generation"
    if (key.startsWith("references/")) return "reference_upload"
    return null
}

export const getMetadataString = (metadata: unknown, key: string) =>
    typeof metadata === "object" &&
    metadata !== null &&
    key in metadata &&
    typeof (metadata as Record<string, unknown>)[key] === "string"
        ? ((metadata as Record<string, unknown>)[key] as string)
        : undefined

export const getMetadataNumber = (metadata: unknown, key: string) =>
    typeof metadata === "object" &&
    metadata !== null &&
    key in metadata &&
    typeof (metadata as Record<string, unknown>)[key] === "number"
        ? ((metadata as Record<string, unknown>)[key] as number)
        : undefined

export const assertOwnedImageKey = async (
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
        mimeType: contentType,
        size: getMetadataNumber(metadata, "size")
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
