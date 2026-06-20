import type { ImageResolution, ImageSize } from "../types"
import type {
    FalGeneratedImage,
    FalImageDescriptor,
    FalImageParseResult,
    FalImageRequest
} from "./types"

export const isFalImageSizeSupported = (descriptor: FalImageDescriptor, imageSize: ImageSize) => {
    if (descriptor.imageSizeMode === "legacyOpenAi") {
        return Boolean(toLegacyOpenAiImageSize(imageSize))
    }

    if (descriptor.imageSizeMode === "standard") {
        return imageSize.includes("x") || Boolean(STANDARD_FAL_IMAGE_SIZES["1K"][imageSize])
    }

    if (descriptor.imageSizeMode === "seedream") {
        return imageSize.includes("x") || Boolean(SEEDREAM_FAL_IMAGE_SIZES["1K"][imageSize])
    }

    return !imageSize.includes("x")
}

const STANDARD_FAL_IMAGE_SIZES: Record<ImageResolution, Partial<Record<ImageSize, string>>> = {
    "1K": {
        "1:1": "1024x1024",
        "16:9": "1280x720",
        "9:16": "720x1280",
        "4:3": "1024x768",
        "3:4": "768x1024",
        "3:2": "1152x768",
        "2:3": "768x1152",
        "5:4": "1280x1024",
        "4:5": "1024x1280",
        "21:9": "1568x672"
    },
    "2K": {
        "1:1": "2048x2048",
        "16:9": "2048x1152",
        "9:16": "1152x2048",
        "4:3": "2048x1536",
        "3:4": "1536x2048",
        "3:2": "2048x1360",
        "2:3": "1360x2048",
        "5:4": "2048x1648",
        "4:5": "1648x2048",
        "21:9": "2240x960"
    },
    "4K": {
        "1:1": "2880x2880",
        "16:9": "3840x2160",
        "9:16": "2160x3840",
        "4:3": "3264x2448",
        "3:4": "2448x3264",
        "3:2": "3456x2304",
        "2:3": "2304x3456",
        "5:4": "3200x2560",
        "4:5": "2560x3200",
        "21:9": "3808x1632"
    }
}

const SEEDREAM_FAL_IMAGE_SIZES: Record<ImageResolution, Partial<Record<ImageSize, string>>> = {
    "1K": {
        "1:1": "2048x2048",
        "16:9": "2560x1440",
        "9:16": "1440x2560",
        "4:3": "2304x1728",
        "3:4": "1728x2304",
        "3:2": "2400x1600",
        "2:3": "1600x2400",
        "5:4": "2400x1920",
        "4:5": "1920x2400",
        "21:9": "3024x1296"
    },
    "2K": {
        "1:1": "2560x2560",
        "16:9": "3072x1728",
        "9:16": "1728x3072",
        "4:3": "2816x2112",
        "3:4": "2112x2816",
        "3:2": "3072x2048",
        "2:3": "2048x3072",
        "5:4": "3200x2560",
        "4:5": "2560x3200",
        "21:9": "3360x1440"
    },
    "4K": {
        "1:1": "4096x4096",
        "16:9": "4096x2304",
        "9:16": "2304x4096",
        "4:3": "4096x3072",
        "3:4": "3072x4096",
        "3:2": "4096x2730",
        "2:3": "2730x4096",
        "5:4": "4096x3277",
        "4:5": "3277x4096",
        "21:9": "4032x1728"
    }
}

const LEGACY_OPENAI_IMAGE_SIZE_MAP: Partial<Record<ImageSize, string>> = {
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "3:2": "1536x1024",
    "4:3": "1536x1024",
    "9:16": "1024x1536",
    "2:3": "1024x1536",
    "3:4": "1024x1536"
}

const toFalResolution = (
    resolution: ImageResolution | undefined,
    mode: FalImageDescriptor["resolutionMode"]
) => {
    if (!mode) return undefined
    if (mode === "uppercase") return resolution ?? "1K"

    switch (resolution) {
        case "1K":
            return "1k"
        case "2K":
            return "2k"
        default:
            return undefined
    }
}

const parseImageSize = (size: string) => {
    const [width, height] = size.split("x").map((value) => Number.parseInt(value, 10))

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return { width: 1024, height: 1024 }
    }

    return { width, height }
}

const toStandardFalImageSize = (imageSize: ImageSize, imageResolution?: ImageResolution) => {
    const size = imageSize.includes("x")
        ? imageSize
        : (STANDARD_FAL_IMAGE_SIZES[imageResolution ?? "1K"][imageSize] ?? "1024x1024")

    return parseImageSize(size)
}

const toSeedreamFalImageSize = (imageSize: ImageSize, imageResolution?: ImageResolution) => {
    const size = imageSize.includes("x")
        ? imageSize
        : (SEEDREAM_FAL_IMAGE_SIZES[imageResolution ?? "1K"][imageSize] ?? "2048x2048")

    return parseImageSize(size)
}

const toLegacyOpenAiImageSize = (imageSize: ImageSize) => {
    if (imageSize === "1024x1024" || imageSize === "1536x1024" || imageSize === "1024x1536") {
        return imageSize
    }

    return LEGACY_OPENAI_IMAGE_SIZE_MAP[imageSize]
}

const toAspectRatio = (imageSize: ImageSize) =>
    imageSize.includes(":") ? imageSize.replace("-hd", "") : undefined

export const buildFalImageInput = (descriptor: FalImageDescriptor, request: FalImageRequest) => {
    const maxAssets =
        typeof request.maxAssets === "number" && request.maxAssets > 0
            ? Math.min(request.maxAssets, 10)
            : 1
    const input: Record<string, unknown> = {
        prompt: request.prompt,
        num_images: maxAssets,
        output_format: "png"
    }

    if (descriptor.usesMaxImages) {
        input.max_images = Math.min(maxAssets, 6)
    }

    if (descriptor.safety.enableSafetyChecker === false) {
        input.enable_safety_checker = false
    }

    if (descriptor.safety.safetyTolerance) {
        input.safety_tolerance = descriptor.safety.safetyTolerance
    }

    if (descriptor.imageSizeMode) {
        if (descriptor.imageSizeMode === "standard") {
            input.image_size =
                request.referenceImages.length > 0
                    ? "auto"
                    : toStandardFalImageSize(request.imageSize, request.imageResolution)
        } else if (descriptor.imageSizeMode === "legacyOpenAi") {
            input.image_size =
                request.referenceImages.length > 0
                    ? "auto"
                    : (toLegacyOpenAiImageSize(request.imageSize) ?? "1024x1024")
        } else {
            input.image_size = toSeedreamFalImageSize(request.imageSize, request.imageResolution)
        }
    }

    if (descriptor.usesAspectRatio) {
        input.aspect_ratio = toAspectRatio(request.imageSize) ?? "1:1"
    }

    if (descriptor.resolutionMode) {
        const resolution = toFalResolution(request.imageResolution, descriptor.resolutionMode)
        if (resolution) {
            input.resolution = resolution
        }
    }

    if (descriptor.usesQuality && descriptor.defaultQuality) {
        input.quality = descriptor.defaultQuality
    }

    if (request.referenceImages.length > 0) {
        input.image_urls = request.referenceImages.map((image) => image.url)
    }

    return input
}

export const getFalEndpointForRequest = (
    descriptor: FalImageDescriptor,
    referenceImageCount: number
) =>
    referenceImageCount > 0 && descriptor.editEndpoint
        ? descriptor.editEndpoint
        : descriptor.endpoint

const asObject = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null

const getString = (value: unknown) => (typeof value === "string" ? value : undefined)

const extractImagesFromValue = (value: unknown): FalGeneratedImage[] => {
    const object = asObject(value)
    if (!object) return []

    const images = Array.isArray(object.images)
        ? object.images
        : Array.isArray(object.data)
          ? object.data
          : []

    return images
        .map((image) => {
            if (typeof image === "string") {
                return { url: image }
            }

            const imageObject = asObject(image)
            const url = getString(imageObject?.url)
            if (!url) return null

            return {
                url,
                contentType:
                    getString(imageObject?.content_type) ??
                    getString(imageObject?.contentType) ??
                    getString(imageObject?.mime_type) ??
                    getString(imageObject?.mimeType)
            }
        })
        .filter((image): image is FalGeneratedImage => image !== null)
}

const extractReason = (payload: unknown) => {
    const object = asObject(payload)
    if (!object) return undefined

    const error = object.error
    if (typeof error === "string") return error
    const errorObject = asObject(error)
    if (errorObject) {
        return (
            getString(errorObject.message) ??
            getString(errorObject.detail) ??
            getString(errorObject.reason)
        )
    }

    return (
        getString(object.message) ??
        getString(object.detail) ??
        getString(object.reason) ??
        getString(object.error_message)
    )
}

const isRefusalReason = (reason: string) =>
    /\b(safety|policy|moderation|blocked|filtered|refus|not allowed)\b/i.test(reason)

export const parseFalImagePayload = (payload: unknown): FalImageParseResult => {
    const root = asObject(payload)
    const status = getString(root?.status)
    if (status && status !== "OK" && /\b(error|failed|failure)\b/i.test(status)) {
        return { kind: "error", reason: extractReason(payload) ?? `fal returned status ${status}` }
    }

    const candidates = [
        payload,
        root?.payload,
        root?.data,
        root?.result,
        asObject(root?.payload)?.data,
        asObject(root?.data)?.result
    ]

    for (const candidate of candidates) {
        const images = extractImagesFromValue(candidate)
        if (images.length > 0) {
            return { kind: "images", images }
        }
    }

    const reason =
        candidates.map(extractReason).find((value): value is string => Boolean(value)) ??
        "No image payload returned from fal"

    if (isRefusalReason(reason)) {
        return { kind: "refusal", reason }
    }

    return { kind: "unknown", reason }
}
