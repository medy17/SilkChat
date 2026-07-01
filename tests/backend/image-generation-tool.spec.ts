import { describe, expect, it } from "vitest"
import {
    getSelectableImageModels,
    getSupportedResolutionsForImageModel
} from "../../convex/lib/image_generation/shared"
import {
    type ImageGenerationDefaults,
    PREPARE_IMAGE_GENERATION_TOOL_NAME,
    getPrepareImageGenerationTool
} from "../../convex/lib/tools/image_generation"

const getReferenceCapableModel = () => {
    const model = getSelectableImageModels().find((candidate) => candidate.supportsReferenceImages)
    if (!model) throw new Error("Expected at least one reference-capable image model")
    return model
}

const buildTool = (
    references: Parameters<typeof getPrepareImageGenerationTool>[0]["references"],
    defaults?: ImageGenerationDefaults
) => {
    const tools = getPrepareImageGenerationTool({ enabled: true, references, defaults })
    const imageTool = tools[PREPARE_IMAGE_GENERATION_TOOL_NAME]
    expect(imageTool).toBeDefined()
    return imageTool
}

describe("prepareImageGeneration tool", () => {
    it("honors the reference ids the model selects (edit path)", async () => {
        const model = getReferenceCapableModel()
        const imageTool = buildTool([
            {
                id: "image_ref_1",
                key: "attachments/user-1/screenshot.png",
                source: "attachment",
                label: "screenshot.png",
                mimeType: "image/png"
            }
        ])

        const result = await imageTool?.execute?.(
            {
                title: "Walking logo screenshot",
                prompt: "Edit the provided screenshot so the logo looks like it is walking.",
                modelId: model.id,
                aspectRatio: model.supportedImageSizes?.[0] ?? "1:1",
                resolution: model.supportedImageResolutions?.[0],
                variants: 1,
                referenceIds: ["image_ref_1"]
            },
            { toolCallId: "call-image", messages: [] }
        )

        expect(result).toMatchObject({
            success: true,
            status: "pending_confirmation",
            title: "Walking logo screenshot",
            referenceIds: ["image_ref_1"],
            referenceSources: [
                {
                    id: "image_ref_1",
                    key: "attachments/user-1/screenshot.png",
                    source: "attachment"
                }
            ]
        })
    })

    it("prepares a plain generation when the model omits references", async () => {
        const model = getReferenceCapableModel()
        const imageTool = buildTool([
            {
                id: "image_ref_1",
                key: "attachments/user-1/screenshot.png",
                source: "attachment",
                label: "screenshot.png",
                mimeType: "image/png"
            }
        ])

        const result = await imageTool?.execute?.(
            {
                title: "Walking logo screenshot",
                prompt: "Edit the provided screenshot so the logo looks like it is walking.",
                modelId: model.id,
                aspectRatio: model.supportedImageSizes?.[0] ?? "1:1",
                resolution: model.supportedImageResolutions?.[0],
                variants: 1,
                referenceIds: []
            },
            { toolCallId: "call-image", messages: [] }
        )

        // No prompt sniffing: an empty reference selection is honored as a fresh
        // text-to-image request rather than being rejected.
        expect(result).toMatchObject({
            success: true,
            status: "pending_confirmation",
            referenceIds: [],
            referenceSources: []
        })
    })

    it("applies user defaults on the card when the model omits resolution and variants", async () => {
        const model = getSelectableImageModels().find(
            (candidate) => getSupportedResolutionsForImageModel(candidate).length >= 2
        )
        if (!model) throw new Error("Expected an image model with at least two resolutions")
        const supported = getSupportedResolutionsForImageModel(model)
        const preferredResolution = supported.find((value) => value !== "1K") ?? supported[0]

        const imageTool = buildTool([], {
            resolution: preferredResolution,
            variants: 1
        })

        const result = (await imageTool?.execute?.(
            {
                title: "Sunset over the hills",
                prompt: "A calm sunset over rolling hills.",
                modelId: model.id,
                aspectRatio: model.supportedImageSizes?.[0] ?? "1:1",
                referenceIds: []
            },
            { toolCallId: "call-image", messages: [] }
        )) as { resolution?: string; variants?: number }

        expect(result.resolution).toBe(preferredResolution)
        expect(result.variants).toBe(1)
    })

    it("rejects a duplicate card in the same turn (repeated calls instead of variants)", async () => {
        const model = getSelectableImageModels()[0]
        const imageTool = buildTool([])
        const args = {
            title: "Red heart logo concept",
            prompt: "Stylized red heart logo concept with swooping lines and elegant typography",
            modelId: model.id,
            aspectRatio: model.supportedImageSizes?.[0] ?? "1:1",
            referenceIds: []
        }

        const first = (await imageTool?.execute?.(args, {
            toolCallId: "call-1",
            messages: []
        })) as { success: boolean }
        const second = (await imageTool?.execute?.(args, {
            toolCallId: "call-2",
            messages: []
        })) as { success: boolean; code?: string }

        expect(first.success).toBe(true)
        expect(second.success).toBe(false)
        expect(second.code).toBe("duplicate_card")
    })

    it("allows genuinely different images in the same turn", async () => {
        const model = getSelectableImageModels()[0]
        const imageTool = buildTool([])
        const aspectRatio = model.supportedImageSizes?.[0] ?? "1:1"

        const logo = (await imageTool?.execute?.(
            {
                title: "Brand logo",
                prompt: "A minimalist coffee shop logo",
                modelId: model.id,
                aspectRatio,
                referenceIds: []
            },
            { toolCallId: "call-1", messages: [] }
        )) as { success: boolean }
        const banner = (await imageTool?.execute?.(
            {
                title: "Web banner",
                prompt: "A wide promotional web banner for a coffee shop",
                modelId: model.id,
                aspectRatio,
                referenceIds: []
            },
            { toolCallId: "call-2", messages: [] }
        )) as { success: boolean }

        expect(logo.success).toBe(true)
        expect(banner.success).toBe(true)
    })
})
