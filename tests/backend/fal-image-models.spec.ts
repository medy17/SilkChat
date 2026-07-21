import { describe, expect, it } from "vitest"
import { MODELS_SHARED } from "../../convex/lib/models"
import type { ImageSize } from "../../convex/lib/models"
import {
    buildFalImageInput,
    getFalImageDescriptor,
    isFalImageSizeSupported
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

describe("fal image model payloads", () => {
    it("uses GPT Image 2 image_size objects instead of size strings", () => {
        expect(
            buildFalImageInput(descriptor("gpt-5.4-image-2"), {
                prompt: "A test image",
                imageSize: "9:16",
                imageResolution: "1K",
                referenceImages: [],
                maxAssets: 1
            })
        ).toMatchObject({
            image_size: { width: 720, height: 1280 },
            quality: "low",
            output_format: "png",
            enable_safety_checker: false
        })
    })

    it("uses only image_urls for reference-based edit endpoints", () => {
        const input = buildFalImageInput(descriptor("gpt-5.4-image-2"), {
            prompt: "Edit this",
            imageSize: "1:1",
            referenceImages: [
                { key: "references/user/ref.png", url: "https://example.com/ref.png" }
            ],
            maxAssets: 1
        })

        expect(input).toMatchObject({
            image_size: "auto",
            image_urls: ["https://example.com/ref.png"]
        })
        expect(input).not.toHaveProperty("image_url")
    })

    it("maps legacy GPT Image Mini to the fal GPT Image 1 Mini endpoint", () => {
        const model = descriptor("gpt-5-image-mini")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "1024x1536",
            referenceImages: [],
            maxAssets: 1
        })

        expect(model.endpoint).toBe("fal-ai/gpt-image-1-mini")
        expect(model.editEndpoint).toBe("fal-ai/gpt-image-1-mini/edit")
        expect(input).toMatchObject({
            image_size: "1024x1536",
            quality: "auto"
        })
        expect(input).not.toHaveProperty("enable_safety_checker")
        expect(input).not.toHaveProperty("safety_tolerance")
    })

    it("maps legacy GPT Image to fal GPT Image 1.5 with enum image sizes", () => {
        const model = descriptor("gpt-5-image")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "16:9",
            referenceImages: [],
            maxAssets: 1
        })

        expect(model.endpoint).toBe("fal-ai/gpt-image-1.5")
        expect(model.editEndpoint).toBe("fal-ai/gpt-image-1.5/edit")
        expect(sharedModel("gpt-5-image").supportedImageSizes).toEqual(
            expect.arrayContaining(["16:9", "9:16"])
        )
        expect(input).toMatchObject({
            image_size: "1536x1024",
            quality: "high"
        })

        expect(
            buildFalImageInput(model, {
                prompt: "A test image",
                imageSize: "9:16",
                referenceImages: [],
                maxAssets: 1
            })
        ).toMatchObject({
            image_size: "1024x1536"
        })
    })

    it("maps Gemini 2.5 Flash Image to Nano Banana", () => {
        const model = descriptor("gemini-2.5-flash-image")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "21:9",
            imageResolution: "4K",
            referenceImages: [],
            maxAssets: 1
        })

        expect(model.endpoint).toBe("fal-ai/nano-banana")
        expect(model.editEndpoint).toBe("fal-ai/nano-banana/edit")
        expect(sharedModel("gemini-2.5-flash-image").supportedImageSizes).toContain("21:9")
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            safety_tolerance: "1"
        })
        expect(input).not.toHaveProperty("resolution")
    })

    it("maps Gemini Flash Preview to Nano Banana 2 with uppercase resolution", () => {
        const model = descriptor("gemini-3.1-flash-image-preview")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "21:9",
            imageResolution: "4K",
            referenceImages: [],
            maxAssets: 1
        })

        expect(model.endpoint).toBe("fal-ai/nano-banana-2")
        expect(sharedModel("gemini-3.1-flash-image-preview").supportedImageSizes).toContain("21:9")
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            resolution: "4K",
            safety_tolerance: "1"
        })
        expect(input).not.toHaveProperty("enable_safety_checker")
    })

    it("maps Gemini 3.1 Flash Lite to Nano Banana 2 Lite without a resolution", () => {
        const model = descriptor("gemini-3.1-flash-lite-image")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "21:9",
            imageResolution: "4K",
            referenceImages: [],
            maxAssets: 1
        })

        expect(model.endpoint).toBe("google/nano-banana-2-lite")
        expect(model.editEndpoint).toBe("google/nano-banana-2-lite/edit")
        expect(sharedModel("gemini-3.1-flash-lite-image").supportedImageResolutions).toBeUndefined()
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            safety_tolerance: "1"
        })
        expect(input).not.toHaveProperty("resolution")
    })

    it("maps Gemini Pro to its fal endpoint and safety tolerance", () => {
        const model = descriptor("gemini-3-pro-image-preview")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "21:9",
            imageResolution: "2K",
            referenceImages: [],
            maxAssets: 1
        })

        expect(model.endpoint).toBe("fal-ai/gemini-3-pro-image-preview")
        expect(input).toMatchObject({
            aspect_ratio: "21:9",
            resolution: "2K",
            safety_tolerance: "1"
        })
    })

    it("uses Grok quality endpoints for the in-app Pro model", () => {
        const model = descriptor("grok-imagine-image-pro")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "20:9",
            imageResolution: "2K",
            referenceImages: [],
            maxAssets: 1
        })

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
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "3:2",
            imageResolution: "1K",
            referenceImages: [],
            maxAssets: 1
        })

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
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "21:9",
            imageResolution: "4K",
            referenceImages: [],
            maxAssets: 1
        })

        expect(model.endpoint).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image")
        expect(model.editEndpoint).toBe("fal-ai/bytedance/seedream/v4.5/edit")
        expect(sharedModel("seedream-4-5").supportedImageSizes).toContain("21:9")
        expect(input).toMatchObject({
            image_size: { width: 4032, height: 1728 },
            max_images: 1,
            enable_safety_checker: false
        })
        expect(input).not.toHaveProperty("output_format")
        expect(input).not.toHaveProperty("safety_tolerance")
    })

    it("registers Seedream 5 Lite with text and edit support through 4K", () => {
        expect(sharedModel("seedream-5-lite").supportedImageResolutions).toEqual([
            "1K",
            "2K",
            "4K"
        ])
        expect(descriptor("seedream-5-lite")).toMatchObject({
            endpoint: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
            editEndpoint: "fal-ai/bytedance/seedream/v5/lite/edit"
        })
    })

    it("uses Seedream 5 Pro endpoints and caps output sizing at 2K", () => {
        const model = descriptor("seedream-5-pro")
        const input = buildFalImageInput(model, {
            prompt: "A test image",
            imageSize: "16:9",
            imageResolution: "2K",
            referenceImages: [{ key: "reference", url: "https://example.com/reference.png" }],
            maxAssets: 1
        })

        expect(sharedModel("seedream-5-pro")).toMatchObject({
            supportedImageResolutions: ["1K", "2K"],
            maxReferenceImages: 10
        })
        expect(sharedModel("seedream-5-pro").legacy).toBeUndefined()
        expect(model).toMatchObject({
            endpoint: "bytedance/seedream/v5/pro/text-to-image",
            editEndpoint: "bytedance/seedream/v5/pro/edit"
        })
        expect(input).toMatchObject({
            image_size: { width: 2048, height: 1152 },
            image_urls: ["https://example.com/reference.png"],
            enable_safety_checker: false
        })
        expect(input).not.toHaveProperty("output_format")
        expect(input).not.toHaveProperty("max_images")
    })

    it("rejects malformed custom image sizes instead of silently falling back", () => {
        const model = descriptor("gpt-5.4-image-2")
        const malformedSize = "wide-x-tall" as ImageSize

        expect(isFalImageSizeSupported(model, malformedSize)).toBe(false)
        expect(() =>
            buildFalImageInput(model, {
                prompt: "A test image",
                imageSize: malformedSize,
                imageResolution: "1K",
                referenceImages: [],
                maxAssets: 1
            })
        ).toThrow("Invalid fal image size")
    })
})
