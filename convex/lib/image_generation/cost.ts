import type { ImageQuality, ImageResolution, ImageSize, SharedModel } from "../models"
import { getFalImageDescriptor, getFalOutputImageDimensions } from "../models/fal"

export const IMAGE_COST_ANCHORS_USD = [0.01, 0.03, 0.1, 0.3, 1] as const
export type ImageCostLevel = 0 | 1 | 2 | 3 | 4

export type ImageCostEstimate = {
    totalUsd: number
    usdPerImage: number
    variants: number
    referenceCount: number
}

const getFixedUsdPerImage = (
    model: SharedModel,
    aspectRatio: ImageSize,
    resolution: ImageResolution,
    quality: ImageQuality
) => {
    const pricing = model.imagePricing
    if (!pricing) return undefined

    const qualityPrices = pricing.usdPerImageByQualityAndResolution?.[quality]
    const descriptor = getFalImageDescriptor(model.id)
    const dimensions = descriptor
        ? getFalOutputImageDimensions(descriptor, aspectRatio, resolution)
        : undefined
    const sizePrice = dimensions
        ? pricing.usdPerImageByQualityAndSize?.[quality]?.[
              `${dimensions.width}x${dimensions.height}` as ImageSize
          ]
        : undefined
    if (sizePrice !== undefined) return sizePrice

    if (qualityPrices) {
        return qualityPrices[resolution] ?? qualityPrices["1K"]
    }

    return pricing.usdPerImageByResolution?.[resolution] ?? pricing.usdPerImage
}

const getOutputMegapixels = (
    model: SharedModel,
    aspectRatio: ImageSize,
    resolution: ImageResolution
) => {
    const descriptor = getFalImageDescriptor(model.id)
    const dimensions = descriptor
        ? getFalOutputImageDimensions(descriptor, aspectRatio, resolution)
        : undefined
    if (!dimensions) return 1
    return (dimensions.width * dimensions.height) / 1_000_000
}

export const estimateImageCost = ({
    model,
    aspectRatio = "1:1",
    resolution = "1K",
    quality,
    variants = 1,
    referenceCount = 0
}: {
    model: SharedModel
    aspectRatio?: ImageSize
    resolution?: ImageResolution
    quality?: ImageQuality
    variants?: number
    referenceCount?: number
}): ImageCostEstimate | null => {
    const pricing = model.imagePricing
    if (!pricing) return null

    const normalizedVariants = Math.max(1, Math.trunc(variants))
    const normalizedReferenceCount = Math.max(0, Math.trunc(referenceCount))
    const normalizedQuality = quality ?? model.defaultImageQuality ?? "auto"

    let usdPerImage: number | undefined
    if (pricing.kind === "fixed") {
        usdPerImage = getFixedUsdPerImage(model, aspectRatio, resolution, normalizedQuality)
    } else if (pricing.kind === "gpt_image_2_5") {
        const descriptor = getFalImageDescriptor(model.id)
        const dimensions = descriptor
            ? getFalOutputImageDimensions(descriptor, aspectRatio, resolution)
            : undefined
        if (!dimensions) return null
        // OpenAI's September 2026 output calculator. Auto uses the model's high default
        // as a reservation estimate. Inputs and auto-sized edits reconcile through fal.
        // https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency
        const gridSide = { low: 16, medium: 24, high: 48, xhigh: 64, max: 96, auto: 48 }[
            normalizedQuality
        ]
        const { width, height } = dimensions
        const shortSide = gridSide / (Math.max(width, height) / Math.min(width, height))
        const floor = Math.floor(shortSide)
        // The provider calculator rounds exact halves to the nearest even integer.
        const roundedShortSide =
            shortSide - floor === 0.5 ? floor + (floor % 2) : Math.round(shortSide)
        const outputTokens = Math.ceil(
            (gridSide * roundedShortSide * (2_000_000 + width * height)) / 4_000_000
        )
        usdPerImage = (outputTokens * 30) / 1_000_000
    } else if (pricing.usdPerOutputMegapixel !== undefined) {
        let megapixels = getOutputMegapixels(model, aspectRatio, resolution)
        megapixels = Math.max(megapixels, pricing.minimumBillableOutputMegapixels ?? 0)
        if (pricing.roundOutputMegapixelsUp) megapixels = Math.ceil(megapixels)
        usdPerImage = megapixels * pricing.usdPerOutputMegapixel
    }

    if (usdPerImage === undefined || !Number.isFinite(usdPerImage)) return null

    const referencePrice =
        pricing.usdPerReferenceImageByQuality?.[normalizedQuality] ??
        pricing.usdPerReferenceImage ??
        0
    const billableReferenceCount = Math.max(
        0,
        normalizedReferenceCount - (pricing.freeReferenceImages ?? 0)
    )
    let requestUsdPerImage = usdPerImage + referencePrice * billableReferenceCount
    const roundingIncrement = pricing.roundRequestUsdUpTo
    if (
        roundingIncrement !== undefined &&
        Number.isFinite(roundingIncrement) &&
        roundingIncrement > 0
    ) {
        requestUsdPerImage =
            Math.ceil((requestUsdPerImage - Number.EPSILON) / roundingIncrement) * roundingIncrement
    }

    return {
        totalUsd: requestUsdPerImage * normalizedVariants,
        usdPerImage: requestUsdPerImage,
        variants: normalizedVariants,
        referenceCount: normalizedReferenceCount
    }
}

export const getImageCostLevel = (totalUsd: number): ImageCostLevel | null => {
    if (!Number.isFinite(totalUsd) || totalUsd < 0) return null
    if (totalUsd === 0) return 0

    let closestLevel: ImageCostLevel = 0
    let closestDistance = Number.POSITIVE_INFINITY
    for (const [index, anchor] of IMAGE_COST_ANCHORS_USD.entries()) {
        const distance = Math.abs(Math.log(totalUsd / anchor))
        if (distance < closestDistance) {
            closestLevel = index as ImageCostLevel
            closestDistance = distance
        }
    }
    return closestLevel
}
