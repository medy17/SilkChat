import { describe, expect, it } from "vitest"
import { MODELS_SHARED } from "../../convex/lib/models"
import type { ImageResolution } from "../../convex/lib/models"
import {
    type FalImageRequest,
    type FalReferenceImage,
    buildFalImageInput,
    getFalEndpointForRequest,
    getFalImageDescriptor,
    resolveImageSizeForModel
} from "../../convex/lib/models/fal"

const descriptor = (modelId: string) => {
    const value = getFalImageDescriptor(modelId)
    if (!value) throw new Error(`Missing fal descriptor for ${modelId}`)
    return value
}

const sharedModel = (modelId: string) => {
    const value = MODELS_SHARED.find((model) => model.id === modelId)
    if (!value) throw new Error(`Missing shared model for ${modelId}`)
    return value
}

// Builds the fal input the way a real request does: resolve the size, then build.
const buildInput = (
    modelId: string,
    {
        size,
        resolution,
        referenceImages = [],
        ...rest
    }: {
        size: string
        resolution?: ImageResolution
        referenceImages?: FalReferenceImage[]
    } & Partial<Omit<FalImageRequest, "size" | "referenceImages">>
) => {
    const resolved = resolveImageSizeForModel({
        model: sharedModel(modelId),
        size,
        resolution,
        referenceCount: referenceImages.length
    })
    if (!resolved?.ok) throw new Error(`Unresolvable size ${size} for ${modelId}`)
    return buildFalImageInput(descriptor(modelId), {
        prompt: "A test image",
        size: resolved.size,
        referenceImages,
        maxAssets: 1,
        ...rest
    })
}

const reference = { key: "references/user/ref.png", url: "https://example.com/ref.png" }

describe("fal image model payloads", () => {
    it("always sends an explicit background so GPT Image never picks one itself", () => {
        const request = { size: "1:1", resolution: "1K" as const }

        expect(
            buildInput("gpt-image-2.5-flare", { ...request, transparentBackground: true })
        ).toMatchObject({ background: "transparent", output_format: "png" })
        expect(buildInput("gpt-image-2.5-flare", request)).toMatchObject({
            background: "opaque"
        })
        expect(
            buildInput("seedream-5-lite", { ...request, transparentBackground: true })
        ).not.toHaveProperty("background")
    })

    it("uses GPT Image 2 image_size objects instead of size strings", () => {
        expect(buildInput("gpt-5.4-image-2", { size: "9:16", resolution: "1K" })).toMatchObject({
            image_size: { width: 720, height: 1280 },
            quality: "medium",
            output_format: "png",
            enable_safety_checker: false
        })
    })

    it("preserves GPT Image 2 resolution and aspect ratio for reference-based edits", () => {
        const input = buildInput("gpt-5.4-image-2", {
            size: "3:4",
            resolution: "4K",
            referenceImages: [reference]
        })

        expect(input).toMatchObject({
            image_size: { width: 2448, height: 3264 },
            image_urls: ["https://example.com/ref.png"]
        })
        expect(input).not.toHaveProperty("image_url")
    })

    it("maps legacy GPT Image Mini to the fal GPT Image 1 Mini endpoint", () => {
        const model = descriptor("gpt-5-image-mini")
        const input = buildInput("gpt-5-image-mini", { size: "1024x1536" })

        expect(model.endpoint).toBe("fal-ai/gpt-image-1-mini")
        expect(model.editEndpoint).toBe("fal-ai/gpt-image-1-mini/edit")
        expect(input).toMatchObject({
            image_size: "1024x1536",
            quality: "auto"
        })
        expect(input).not.toHaveProperty("enable_safety_checker")
        expect(input).not.toHaveProperty("safety_tolerance")
    })

    it("maps legacy GPT Image to fal GPT Image 1.5 with enum sizes and auto-sized edits", () => {
        const model = descriptor("gpt-5-image")

        expect(model.endpoint).toBe("fal-ai/gpt-image-1.5")
        expect(model.editEndpoint).toBe("fal-ai/gpt-image-1.5/edit")
        expect(buildInput("gpt-5-image", { size: "16:9" })).toMatchObject({
            image_size: "1536x1024",
            quality: "high"
        })
        expect(buildInput("gpt-5-image", { size: "9:16" })).toMatchObject({
            image_size: "1024x1536"
        })
        expect(
            buildInput("gpt-5-image", { size: "9:16", referenceImages: [reference] })
        ).toMatchObject({ image_size: "auto" })
    })

    it("maps Gemini 2.5 Flash Image to Nano Banana", () => {
        const model = descriptor("gemini-2.5-flash-image")
        const input = buildInput("gemini-2.5-flash-image", { size: "21:9", resolution: "4K" })

        expect(model.endpoint).toBe("fal-ai/nano-banana")
        expect(model.editEndpoint).toBe("fal-ai/nano-banana/edit")
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            safety_tolerance: "6"
        })
        expect(input).not.toHaveProperty("resolution")
        expect(input).not.toHaveProperty("image_size")
    })

    it("maps Gemini Flash Preview to Nano Banana 2 with uppercase resolution", () => {
        const model = descriptor("gemini-3.1-flash-image-preview")
        const input = buildInput("gemini-3.1-flash-image-preview", {
            size: "21:9",
            resolution: "4K"
        })

        expect(model.endpoint).toBe("fal-ai/nano-banana-2")
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            resolution: "4K",
            safety_tolerance: "6"
        })
        expect(input).not.toHaveProperty("enable_safety_checker")
    })

    it("maps Gemini 3.1 Flash Lite to Nano Banana 2 Lite without a resolution", () => {
        const model = descriptor("gemini-3.1-flash-lite-image")
        const input = buildInput("gemini-3.1-flash-lite-image", { size: "21:9", resolution: "4K" })

        expect(model.endpoint).toBe("google/nano-banana-2-lite")
        expect(model.editEndpoint).toBe("google/nano-banana-2-lite/edit")
        expect(sharedModel("gemini-3.1-flash-lite-image").supportedImageResolutions).toBeUndefined()
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            safety_tolerance: "6"
        })
        expect(input).not.toHaveProperty("resolution")
    })

    it("maps Gemini Pro to its fal endpoint and safety tolerance", () => {
        const model = descriptor("gemini-3-pro-image-preview")
        const input = buildInput("gemini-3-pro-image-preview", { size: "21:9", resolution: "2K" })

        expect(model.endpoint).toBe("fal-ai/gemini-3-pro-image-preview")
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            resolution: "2K",
            safety_tolerance: "6"
        })
    })

    it("uses Grok quality endpoints for the in-app Pro model", () => {
        const model = descriptor("grok-imagine-image-pro")
        const input = buildInput("grok-imagine-image-pro", { size: "20:9", resolution: "2K" })

        expect(model.endpoint).toBe("xai/grok-imagine-image/quality/text-to-image")
        expect(model.editEndpoint).toBe("xai/grok-imagine-image/quality/edit")
        expect(input).toMatchObject({
            aspect_ratio: "20:9",
            resolution: "2k"
        })
        expect(input).not.toHaveProperty("enable_safety_checker")
        expect(input).not.toHaveProperty("safety_tolerance")
    })

    it("ships Grok reference limits through shared model metadata", () => {
        expect(sharedModel("grok-imagine-image").maxReferenceImages).toBe(3)
        expect(sharedModel("grok-imagine-image-pro").maxReferenceImages).toBe(3)
    })

    it("marks Grok models as settling after safety rejection", () => {
        expect(descriptor("grok-imagine-image").settlesAfterSafetyRejection).toBe(true)
        expect(descriptor("grok-imagine-image-pro").settlesAfterSafetyRejection).toBe(true)
        expect(descriptor("gemini-3-pro-image-preview").settlesAfterSafetyRejection).toBeUndefined()
    })

    it("uses FLUX 2 Flex image_size and does not advertise a fal edit endpoint", () => {
        const model = descriptor("flux-2-flex")
        const input = buildInput("flux-2-flex", { size: "3:2", resolution: "1K" })

        expect(model.editEndpoint).toBeUndefined()
        expect(model.supportsReferences).toBe(false)
        expect(input).toMatchObject({
            image_size: { width: 1152, height: 768 },
            enable_safety_checker: false,
            safety_tolerance: "1"
        })
    })

    it("keeps older Seedream versions callable as legacy models", () => {
        expect(sharedModel("seedream-4")).toMatchObject({
            legacy: true,
            replacementId: "seedream-5-pro"
        })
        expect(sharedModel("seedream-4-5")).toMatchObject({
            legacy: true,
            replacementId: "seedream-5-pro"
        })
        expect(descriptor("seedream-4")).toMatchObject({
            endpoint: "fal-ai/bytedance/seedream/v4/text-to-image",
            editEndpoint: "fal-ai/bytedance/seedream/v4/edit"
        })
    })

    it("uses Seedream 4.5 text/edit endpoints and valid large image sizes", () => {
        const model = descriptor("seedream-4-5")
        const input = buildInput("seedream-4-5", { size: "21:9", resolution: "4K" })

        expect(model.endpoint).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image")
        expect(model.editEndpoint).toBe("fal-ai/bytedance/seedream/v4.5/edit")
        expect(input).toMatchObject({
            image_size: { width: 4032, height: 1728 },
            max_images: 1,
            enable_safety_checker: false
        })
        expect(input).not.toHaveProperty("output_format")
        expect(input).not.toHaveProperty("safety_tolerance")
    })

    it("registers Seedream 5 Lite with text and edit support through 4K", () => {
        expect(sharedModel("seedream-5-lite").supportedImageResolutions).toEqual(["1K", "2K", "4K"])
        expect(descriptor("seedream-5-lite")).toMatchObject({
            endpoint: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
            editEndpoint: "fal-ai/bytedance/seedream/v5/lite/edit"
        })
    })

    it("uses Seedream 5 Pro endpoints and caps output sizing at 2K", () => {
        const input = buildInput("seedream-5-pro", {
            size: "16:9",
            resolution: "2K",
            referenceImages: [reference]
        })

        expect(sharedModel("seedream-5-pro")).toMatchObject({
            supportedImageResolutions: ["1K", "2K"],
            maxReferenceImages: 10
        })
        expect(descriptor("seedream-5-pro")).toMatchObject({
            endpoint: "bytedance/seedream/v5/pro/text-to-image",
            editEndpoint: "bytedance/seedream/v5/pro/edit"
        })
        expect(input).toMatchObject({
            image_size: { width: 2048, height: 1152 },
            image_urls: ["https://example.com/ref.png"],
            enable_safety_checker: false
        })
        expect(input).not.toHaveProperty("output_format")
        expect(input).not.toHaveProperty("max_images")
    })
})

it.each(["flare", "sunburst"])(
    "sends GPT Image 2.6 %s reasoning effort separately from quality",
    (variant) => {
        const modelId = `gpt-image-2.6-${variant}`
        const model = descriptor(modelId)
        expect(getFalEndpointForRequest(model, 0)).toBe(
            `openai/gpt-image-2.6/${variant}/text-to-image`
        )
        expect(getFalEndpointForRequest(model, 1)).toBe(`openai/gpt-image-2.6/${variant}/edit`)
        const request = { size: "3:4", resolution: "1K" as const }
        expect(buildInput(modelId, request)).toMatchObject({
            quality: "high",
            reasoning_effort: "high",
            enable_safety_checker: false
        })
        expect(
            buildInput(modelId, { ...request, quality: "low", reasoningEffort: "medium" })
        ).toMatchObject({ quality: "low", reasoning_effort: "medium" })
        expect(buildInput(`gpt-image-2.5-${variant}`, request)).not.toHaveProperty(
            "reasoning_effort"
        )
    }
)

it.each(["flare", "sunburst"])(
    "routes GPT Image 2.5 %s generation and edits with high as default",
    (variant) => {
        const modelId = `gpt-image-2.5-${variant}`
        const model = descriptor(modelId)
        expect(getFalEndpointForRequest(model, 0)).toBe(
            `openai/gpt-image-2.5/${variant}/text-to-image`
        )
        expect(getFalEndpointForRequest(model, 1)).toBe(`openai/gpt-image-2.5/${variant}/edit`)
        const request = { size: "3:4", resolution: "4K" as const }
        expect(buildInput(modelId, request).quality).toBe("high")
        expect(buildInput(modelId, { ...request, quality: "max" }).quality).toBe("max")
        expect(buildInput(modelId, { ...request, referenceImages: [reference] })).toMatchObject({
            image_size: { width: 2448, height: 3264 },
            image_urls: ["https://example.com/ref.png"],
            quality: "high",
            enable_safety_checker: false
        })
    }
)
