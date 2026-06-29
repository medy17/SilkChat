import { describe, expect, it } from "vitest"
import { getSelectableImageModels } from "../../convex/lib/image_generation/shared"
import {
    PREPARE_IMAGE_GENERATION_TOOL_NAME,
    getPrepareImageGenerationTool
} from "../../convex/lib/tools/image_generation"

const getReferenceCapableModel = () => {
    const model = getSelectableImageModels().find((candidate) => candidate.supportsReferenceImages)
    if (!model) throw new Error("Expected at least one reference-capable image model")
    return model
}

const buildTool = (
    references: Parameters<typeof getPrepareImageGenerationTool>[0]["references"]
) => {
    const tools = getPrepareImageGenerationTool({ enabled: true, references })
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
})
