import { formatImageSize, parseImageSizeInput } from "@/lib/image-aspect-ratios"
import type { GenericActionCtx } from "convex/server"
import { nanoid } from "nanoid"
import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import type { DataModel } from "../../_generated/dataModel"
import { r2 } from "../../attachments"
import { resolveRequiredPlanForModelAccess } from "../credits"
import { MODELS_SHARED } from "../models"
import type { ImageQuality, ImageResolution, PrototypeAccessPlan, SharedModel } from "../models"
import {
    type FalReferenceImage,
    type ImageSizeResolution,
    describeImageSizeFailure,
    getFalImageDescriptor,
    resolveImageSizeForModel
} from "../models/fal"
import { estimateImageCost } from "./cost"

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
    estimatedUsd?: number
}

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

export const getSelectableImageModels = (userPlan: PrototypeAccessPlan = "pro") =>
    MODELS_SHARED.filter(
        (model) =>
            model.mode === "image" &&
            !model.sunsetOn &&
            (userPlan === "pro" || getImageModelCreditEstimate(model).requiredPlan === "free")
    )

export const getSupportedAspectRatiosForImageModel = (model: SharedModel) => {
    const supported = model.supportedImageSizes ?? []
    return supported.filter(
        (size) => resolveImageSizeForModel({ model, size, resolution: undefined })?.ok !== false
    )
}

export const getSupportedResolutionsForImageModel = (model: SharedModel) =>
    model.supportedImageResolutions ?? []

export const formatImageModelCapabilitySummary = (models: readonly SharedModel[]) => {
    const groups = new Map<
        string,
        {
            aspectRatios: string[]
            models: SharedModel[]
        }
    >()

    for (const model of models) {
        const aspectRatios = getSupportedAspectRatiosForImageModel(model)
        const key = JSON.stringify(aspectRatios)
        const group = groups.get(key)
        if (group) {
            group.models.push(model)
        } else {
            groups.set(key, { aspectRatios, models: [model] })
        }
    }

    if (groups.size === 0) return "- None"

    return Array.from(groups.values())
        .map(({ aspectRatios, models: groupedModels }) => {
            const modelLines = groupedModels.map((model) => {
                const resolutions = getSupportedResolutionsForImageModel(model)
                const referenceLimit = model.supportsReferenceImages
                    ? typeof model.maxReferenceImages === "number"
                        ? `max ${model.maxReferenceImages}`
                        : "model limit"
                    : "none"

                return `- ${model.id} (${model.name}) — res: ${resolutions.join("|") || "default only"}; refs: ${referenceLimit}; variants: max ${getImageModelMaxPerMessage(model)}${model.supportsTransparentBackground ? "; transparent background" : ""}`
            })

            return [`Aspect ratios: ${aspectRatios.join(", ") || "default"}`, ...modelLines].join(
                "\n"
            )
        })
        .join("\n\n")
}

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
    quality,
    transparentBackground,
    defaults,
    onUnsupportedSize = "reject"
}: {
    modelId: string
    aspectRatio?: string
    resolution?: string
    variants?: number
    referenceCount: number
    quality?: ImageQuality
    transparentBackground?: boolean
    // Soft per-user defaults: fill an empty field, are outranked by an explicit model
    // choice, and are themselves clamped to the model's capabilities below.
    defaults?: {
        resolution?: ImageResolution
        variants?: number
    }
    // "fallback" only where the user sees the result before paying (the chat-tool card).
    // Everywhere else a size the model can't make fails before any credit is reserved.
    onUnsupportedSize?: "reject" | "fallback"
}) => {
    const model = getImageModelById(modelId)
    if (!model) {
        throw new Error("Image model not found.")
    }

    const descriptor = getFalImageDescriptor(model.id)
    if (!descriptor) {
        throw new Error("Image model is not available on fal.")
    }

    // Resolution and variant count are coerced to legal values rather than rejected: the
    // chat model selects from a union of every model's enums, so a value that's valid in
    // general can still be illegal for the specific model picked. Sizes follow
    // `onUnsupportedSize`. References are the exception (handled below) — silently
    // dropping a reference would change intent. A malformed size is a bad request.
    const requestedSize = aspectRatio ? parseImageSizeInput(aspectRatio) : null
    if (aspectRatio && !requestedSize) {
        throw new Error("Invalid aspect ratio.")
    }

    const supportedResolutions = getSupportedResolutionsForImageModel(model)
    const requestedResolution = resolution as ImageResolution | undefined
    let selectedResolution: ImageResolution | undefined
    if (supportedResolutions.length === 0) {
        // Model takes no explicit resolution; keep a real tier if one was passed, since sizes
        // are looked up by tier, and drop anything else.
        selectedResolution =
            requestedResolution && RESOLUTION_ORDER.includes(requestedResolution)
                ? requestedResolution
                : undefined
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

    const resolveSize = (size: string): ImageSizeResolution =>
        resolveImageSizeForModel({
            model,
            size,
            resolution: selectedResolution,
            referenceCount
        }) ?? { ok: false, reason: "This model has no fal endpoint." }
    const defaultSize = getSupportedAspectRatiosForImageModel(model)[0] ?? "1:1"
    const requested = requestedSize ? formatImageSize(requestedSize) : defaultSize
    let resolvedSize = resolveSize(requested)
    if (!resolvedSize.ok && onUnsupportedSize === "fallback") {
        resolvedSize = resolveSize(defaultSize)
    }
    if (!resolvedSize.ok) {
        throw new Error(describeImageSizeFailure(model.name, requested, resolvedSize))
    }
    const { size } = resolvedSize

    return {
        model,
        descriptor,
        aspectRatio: size.canonical,
        resolution: size.resolution,
        size,
        variants: selectedVariants,
        // Dropped rather than rejected on models without alpha output, like the other
        // coerced fields: the request still makes sense with an opaque background.
        transparentBackground: Boolean(
            transparentBackground && model.supportsTransparentBackground
        ),
        creditEstimate: {
            ...getImageModelCreditEstimate(model),
            estimatedUsd: estimateImageCost({
                model,
                aspectRatio: size.canonical,
                resolution: size.resolution,
                quality,
                variants: selectedVariants,
                referenceCount
            })?.totalUsd
        }
    }
}

export const getReferenceSourceForKey = (key: string): ImageReferenceSource["source"] | null => {
    if (key.startsWith("attachments/")) return "attachment"
    if (key.startsWith("generations/")) return "generation"
    if (key.startsWith("references/")) return "reference_upload"
    if (key.startsWith("image-search/")) return "reference_upload"
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
