import { beforeEach, describe, expect, it, vi } from "vitest"

const { generateAndStoreImageMock, getModelMock, getUserIdentityMock } = vi.hoisted(() => ({
    generateAndStoreImageMock: vi.fn(),
    getModelMock: vi.fn(),
    getUserIdentityMock: vi.fn()
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        credits: {
            reserveCreditForMessage: "reserveCreditForMessage",
            commitReservedCreditForMessage: "commitReservedCreditForMessage",
            releaseReservedCreditForMessage: "releaseReservedCreditForMessage"
        },
        images: {
            insertGeneratedImage: "insertGeneratedImage"
        }
    }
}))

vi.mock("../../convex/chat_http/get_model", () => ({
    getModel: getModelMock
}))

vi.mock("../../convex/chat_http/image_generation", () => ({
    generateAndStoreImage: generateAndStoreImageMock
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/attachments", () => ({
    r2: {
        store: vi.fn()
    }
}))

import { generateStandaloneImage } from "../../convex/images_node"

type GenerateStandaloneImageCtx = {
    auth: Record<string, unknown>
    runMutation: ReturnType<typeof vi.fn>
    runQuery: ReturnType<typeof vi.fn>
}

const generateStandaloneImageHandler = generateStandaloneImage as unknown as (
    ctx: GenerateStandaloneImageCtx,
    args: {
        prompt: string
        modelId: string
        aspectRatio?: string
        resolution?: string
        referenceImageIds?: string[]
    }
) => Promise<string[]>

const createCtx = (): GenerateStandaloneImageCtx =>
    ({
        auth: {},
        runMutation: vi.fn().mockImplementation(async (name: string) => {
            if (name === "reserveCreditForMessage") {
                return { allowed: true, bypassed: false, existing: false, committed: false }
            }

            return "generated-image-1"
        }),
        runQuery: vi.fn()
    }) as GenerateStandaloneImageCtx

const createImageModelData = (
    prototypeCreditTier: "basic" | "pro" = "pro",
    providerSource: "internal" | "byok" | "openrouter" | "custom" | "unknown" = "internal"
) => ({
    model: {
        modelType: "image"
    },
    modelName: "Image Model",
    providerSource,
    registry: {
        models: {
            "image-model": {}
        }
    },
    runtimeApiKey: undefined,
    prototypeCreditTier
})

describe("images_node", () => {
    beforeEach(() => {
        getUserIdentityMock.mockReset()
        getModelMock.mockReset()
        generateAndStoreImageMock.mockReset().mockResolvedValue({
            assets: [
                {
                    imageUrl: "generated-key",
                    imageSize: "1:1"
                }
            ],
            prompt: "A test image",
            modelId: "image-model"
        })
    })

    it("rejects free users before standalone pro image generation runs", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce(createImageModelData("pro"))
        const ctx = createCtx()
        ctx.runMutation.mockImplementationOnce(async () => ({
            allowed: false,
            reason: "plan"
        }))

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "image-model",
                aspectRatio: "1:1"
            })
        ).rejects.toThrow("Pro plan required for image generation.")

        expect(generateAndStoreImageMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                modelId: "image-model",
                requiredPlan: "pro"
            })
        )
    })

    it("rejects non-bypass users once the monthly image bucket is exhausted", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce(createImageModelData("pro"))
        const ctx = createCtx()
        ctx.runMutation.mockImplementationOnce(async () => ({
            allowed: false,
            reason: "quota"
        }))

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "image-model",
                aspectRatio: "1:1"
            })
        ).rejects.toThrow("Monthly plan limit reached for image generation.")

        expect(generateAndStoreImageMock).not.toHaveBeenCalled()
    })

    it("allows pro users to run standalone pro image generation", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce(createImageModelData("pro"))
        const ctx = createCtx()

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "image-model",
                aspectRatio: "1:1"
            })
        ).resolves.toEqual(["generated-image-1"])

        expect(generateAndStoreImageMock).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: "A test image",
                modelId: "image-model",
                userId: "user-1"
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith("insertGeneratedImage", {
            userId: "user-1",
            storageKey: "generated-key",
            prompt: "A test image",
            modelId: "image-model",
            aspectRatio: "1:1",
            resolution: undefined
        })
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                modelId: "image-model",
                providerSource: "internal",
                feature: "image",
                bucket: "pro",
                units: 1,
                counted: true,
                requiredPlan: "pro"
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "commitReservedCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                messageKey: expect.stringContaining("standalone-image:")
            })
        )
    })

    it("allows bypass users to run standalone pro image generation", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce(createImageModelData("pro"))
        const ctx = createCtx()
        ctx.runMutation.mockImplementationOnce(async () => ({
            allowed: true,
            bypassed: true,
            existing: false,
            committed: false
        }))

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "image-model",
                aspectRatio: "1:1"
            })
        ).resolves.toEqual(["generated-image-1"])

        expect(generateAndStoreImageMock).toHaveBeenCalled()
    })

    it("releases the reserved credit when generation fails after reservation", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getModelMock.mockResolvedValueOnce(createImageModelData("pro"))
        generateAndStoreImageMock.mockRejectedValueOnce(new Error("provider failure"))
        const ctx = createCtx()

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "image-model",
                aspectRatio: "1:1"
            })
        ).rejects.toThrow("provider failure")

        expect(ctx.runMutation).toHaveBeenCalledWith(
            "releaseReservedCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                messageKey: expect.stringContaining("standalone-image:")
            })
        )
    })
})
