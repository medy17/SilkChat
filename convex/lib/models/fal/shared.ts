import type {
    FalGeneratedImage,
    FalImageDescriptor,
    FalImageParseResult,
    FalImageRequest
} from "./types"

export const buildFalImageInput = (descriptor: FalImageDescriptor, request: FalImageRequest) => {
    const maxAssets =
        typeof request.maxAssets === "number" && request.maxAssets > 0
            ? Math.min(request.maxAssets, 10)
            : 1
    const input: Record<string, unknown> = {
        prompt: request.prompt,
        num_images: maxAssets
    }

    if (!descriptor.omitOutputFormat) {
        input.output_format = "png"
    }

    // fal's default "auto" lets GPT Image choose from the prompt, which would make
    // transparency untracked. Always send an explicit choice; PNG keeps the alpha.
    if (descriptor.usesBackground) {
        input.background = request.transparentBackground ? "transparent" : "opaque"
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

    Object.assign(input, request.size.falInput)

    if (descriptor.usesQuality && descriptor.defaultQuality) {
        input.quality = request.quality ?? descriptor.defaultQuality
    }

    if (descriptor.defaultReasoningEffort) {
        input.reasoning_effort = request.reasoningEffort ?? descriptor.defaultReasoningEffort
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

export const FAL_IMAGE_SAFETY_MESSAGE =
    "This image request was blocked by the image safety system. Please revise the prompt or references and try again."

export const isFalImageSafetyReason = (reason: string) =>
    /\b(safety|policy|moderation|blocked|filtered|refus|not allowed|unprocessable)\b/i.test(
        reason
    ) || /(?:status code:?\s*)?422\b/i.test(reason)

export const normalizeFalImageErrorMessage = (error: unknown) => {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : JSON.stringify(error)

    if (isFalImageSafetyReason(message)) {
        return FAL_IMAGE_SAFETY_MESSAGE
    }

    return message
}

export const parseFalImagePayload = (payload: unknown): FalImageParseResult => {
    const root = asObject(payload)
    const status = getString(root?.status)
    if (status && status !== "OK" && /\b(error|failed|failure)\b/i.test(status)) {
        const reason = extractReason(payload) ?? `fal returned status ${status}`
        return isFalImageSafetyReason(reason)
            ? { kind: "refusal", reason: FAL_IMAGE_SAFETY_MESSAGE }
            : { kind: "error", reason }
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

    if (isFalImageSafetyReason(reason)) {
        return { kind: "refusal", reason: FAL_IMAGE_SAFETY_MESSAGE }
    }

    return { kind: "unknown", reason }
}
