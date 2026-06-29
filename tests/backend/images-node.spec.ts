import { beforeEach, describe, expect, it, vi } from "vitest"

const { falConfigMock, falQueueSubmitMock, getUserIdentityMock, r2GetMetadataMock, r2GetUrlMock } =
    vi.hoisted(() => ({
        falConfigMock: vi.fn(),
        falQueueSubmitMock: vi.fn(),
        getUserIdentityMock: vi.fn(),
        r2GetMetadataMock: vi.fn(),
        r2GetUrlMock: vi.fn()
    }))

vi.mock("@fal-ai/client", () => ({
    fal: {
        config: falConfigMock,
        queue: {
            submit: falQueueSubmitMock
        }
    }
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        credits: {
            reserveCreditForMessage: "reserveCreditForMessage",
            releaseReservedCreditForMessage: "releaseReservedCreditForMessage"
        },
        messages: {
            claimPreparedImageGenerationCard: "claimPreparedImageGenerationCard",
            patchPreparedImageGenerationToolResult: "patchPreparedImageGenerationToolResult"
        },
        threads: {
            getThreadById: "getThreadById"
        },
        image_generation_jobs: {
            createImageGenerationJob: "createImageGenerationJob",
            attachFalRequestToImageGenerationJob: "attachFalRequestToImageGenerationJob",
            markImageGenerationJobFailed: "markImageGenerationJobFailed"
        },
        images: {
            insertGeneratedImage: "insertGeneratedImage"
        }
    }
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/attachments", () => ({
    r2: {
        store: vi.fn(),
        getMetadata: r2GetMetadataMock,
        getUrl: r2GetUrlMock
    }
}))

import {
    confirmPreparedChatImageGeneration,
    generateStandaloneImage
} from "../../convex/images_node"
import { FAL_IMAGE_SAFETY_MESSAGE } from "../../convex/lib/models/fal"

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
        clientRequestId?: string
        aspectRatio?: string
        resolution?: string
        referenceImageIds?: string[]
    }
) => Promise<string[]>
const confirmPreparedChatImageGenerationHandler = confirmPreparedChatImageGeneration as unknown as (
    ctx: GenerateStandaloneImageCtx,
    args: {
        threadId: string
        assistantMessageId: string
        toolCallId: string
        cardId: string
    }
) => Promise<string[]>

const createCtx = (): GenerateStandaloneImageCtx =>
    ({
        auth: {},
        runMutation: vi.fn().mockImplementation(async (name: string) => {
            if (name === "reserveCreditForMessage") {
                return { allowed: true, bypassed: false, existing: false, committed: false }
            }

            if (name === "createImageGenerationJob") {
                return "image-generation-job-1"
            }

            return null
        }),
        runQuery: vi.fn()
    }) as GenerateStandaloneImageCtx

describe("images_node", () => {
    beforeEach(() => {
        vi.stubEnv("FAL_KEY", "fal-key")
        vi.stubEnv("CONVEX_SITE_URL", "https://silkchat.convex.site/")
        getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" })
        falConfigMock.mockReset()
        falQueueSubmitMock.mockReset().mockResolvedValue({
            request_id: "fal-request-1",
            gateway_request_id: "fal-gateway-request-1"
        })
        r2GetMetadataMock.mockReset().mockResolvedValue({ authorId: "user-1" })
        r2GetUrlMock.mockReset().mockResolvedValue("https://cdn.example.com/reference.png")
    })

    it("rejects free users before submitting to fal", async () => {
        const ctx = createCtx()
        ctx.runMutation.mockImplementationOnce(async () => ({
            allowed: false,
            reason: "plan"
        }))

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "gpt-5.4-image-2",
                aspectRatio: "1:1"
            })
        ).rejects.toThrow("Pro plan required for image generation.")

        expect(falQueueSubmitMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                modelId: "gpt-5.4-image-2",
                providerSource: "internal",
                feature: "image",
                bucket: "pro",
                units: 1,
                counted: true,
                requiredPlan: "pro"
            })
        )
    })

    it("submits standalone image generation to fal queue and records a job", async () => {
        const ctx = createCtx()

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "gpt-5.4-image-2",
                clientRequestId: "client-request-1",
                aspectRatio: "1:1",
                resolution: "1K"
            })
        ).resolves.toEqual(["image-generation-job-1"])

        expect(falConfigMock).toHaveBeenCalledWith({ credentials: "fal-key" })
        expect(falQueueSubmitMock).toHaveBeenCalledWith("openai/gpt-image-2", {
            input: expect.objectContaining({
                prompt: "A test image",
                image_size: { width: 1024, height: 1024 },
                quality: "low",
                enable_safety_checker: false,
                num_images: 1,
                output_format: "png"
            }),
            webhookUrl: "https://silkchat.convex.site/webhooks/fal?jobId=image-generation-job-1"
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("createImageGenerationJob", {
            userId: "user-1",
            clientRequestId: "client-request-1",
            appModelId: "gpt-5.4-image-2",
            falEndpoint: "openai/gpt-image-2",
            prompt: "A test image",
            aspectRatio: "1:1",
            resolution: "1K",
            referenceImageKeys: [],
            creditEventKey: expect.stringContaining("standalone-image:")
        })
        expect(ctx.runMutation).toHaveBeenCalledWith("attachFalRequestToImageGenerationJob", {
            jobId: "image-generation-job-1",
            falRequestId: "fal-request-1",
            falGatewayRequestId: "fal-gateway-request-1"
        })
    })

    it("uploads reference keys to fal input without reusing the app model id as fal id", async () => {
        const ctx = createCtx()

        await generateStandaloneImageHandler(ctx, {
            prompt: "Edit this",
            modelId: "gpt-5.4-image-2",
            aspectRatio: "1:1",
            referenceImageIds: ["references/user-1/ref.png"]
        })

        expect(falQueueSubmitMock).toHaveBeenCalledWith("openai/gpt-image-2/edit", {
            input: expect.objectContaining({
                image_size: "auto",
                image_urls: ["https://cdn.example.com/reference.png"]
            }),
            webhookUrl: "https://silkchat.convex.site/webhooks/fal?jobId=image-generation-job-1"
        })
        expect(falQueueSubmitMock.mock.calls[0]?.[1].input).not.toHaveProperty("image_url")
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "createImageGenerationJob",
            expect.objectContaining({
                appModelId: "gpt-5.4-image-2",
                falEndpoint: "openai/gpt-image-2/edit",
                referenceImageKeys: ["references/user-1/ref.png"]
            })
        )
    })

    it("allows legacy OpenAI image models to receive ratio values mapped by fal descriptors", async () => {
        const ctx = createCtx()

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "gpt-5-image",
                aspectRatio: "1:1"
            })
        ).resolves.toEqual(["image-generation-job-1"])

        expect(falQueueSubmitMock).toHaveBeenCalledWith("fal-ai/gpt-image-1.5", {
            input: expect.objectContaining({
                image_size: "1024x1024",
                quality: "high"
            }),
            webhookUrl: "https://silkchat.convex.site/webhooks/fal?jobId=image-generation-job-1"
        })
    })

    it("rejects references for a text-to-image-only model", async () => {
        const ctx = createCtx()

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "flux-2-flex",
                aspectRatio: "1:1",
                referenceImageIds: ["references/user-1/ref.png"]
            })
        ).rejects.toThrow("Reference images are not supported by this model.")

        expect(falQueueSubmitMock).not.toHaveBeenCalled()
    })

    it("rejects models when reference images exceed the registry limit", async () => {
        const ctx = createCtx()

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "Edit these",
                modelId: "grok-imagine-image",
                aspectRatio: "1:1",
                referenceImageIds: [
                    "references/user-1/ref-1.png",
                    "references/user-1/ref-2.png",
                    "references/user-1/ref-3.png",
                    "references/user-1/ref-4.png"
                ]
            })
        ).rejects.toThrow("This model supports up to 3 reference images.")

        expect(falQueueSubmitMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.anything()
        )
    })

    it("releases reserved credit when fal submission fails after reservation", async () => {
        const ctx = createCtx()
        falQueueSubmitMock.mockRejectedValueOnce(new Error("fal down"))

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "gpt-5.4-image-2",
                aspectRatio: "1:1"
            })
        ).rejects.toThrow("fal down")

        expect(ctx.runMutation).toHaveBeenCalledWith(
            "releaseReservedCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                messageKey: expect.stringContaining("standalone-image:")
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "markImageGenerationJobFailed",
            expect.objectContaining({
                jobId: "image-generation-job-1",
                status: "refunded",
                error: "fal down"
            })
        )
    })

    it("wraps fal 422 submission failures as safety errors", async () => {
        const ctx = createCtx()
        falQueueSubmitMock.mockRejectedValueOnce(new Error("Unexpected status code: 422"))

        await expect(
            generateStandaloneImageHandler(ctx, {
                prompt: "A test image",
                modelId: "gpt-5.4-image-2",
                aspectRatio: "1:1"
            })
        ).rejects.toThrow(FAL_IMAGE_SAFETY_MESSAGE)

        expect(ctx.runMutation).toHaveBeenCalledWith(
            "releaseReservedCreditForMessage",
            expect.objectContaining({
                userId: "user-1",
                messageKey: expect.stringContaining("standalone-image:")
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "markImageGenerationJobFailed",
            expect.objectContaining({
                jobId: "image-generation-job-1",
                status: "refunded",
                error: FAL_IMAGE_SAFETY_MESSAGE
            })
        )
    })

    it("keeps the local pending job when fal accepts without returning a request id", async () => {
        const ctx = createCtx()
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
        falQueueSubmitMock.mockResolvedValueOnce({})

        try {
            await expect(
                generateStandaloneImageHandler(ctx, {
                    prompt: "A test image",
                    modelId: "gpt-5.4-image-2",
                    aspectRatio: "1:1"
                })
            ).resolves.toEqual(["image-generation-job-1"])
        } finally {
            consoleErrorSpy.mockRestore()
        }

        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "releaseReservedCreditForMessage",
            expect.anything()
        )
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "markImageGenerationJobFailed",
            expect.anything()
        )
    })

    it("fails chat confirmation before submitting when requested variants exceed remaining credits", async () => {
        const ctx = createCtx()
        let reservationAttempts = 0
        ctx.runQuery.mockImplementation(async (name: string) => {
            if (name === "getThreadById") {
                return { _id: "thread-1", authorId: "user-1" }
            }
            return null
        })
        ctx.runMutation.mockImplementation(async (name: string) => {
            if (name === "claimPreparedImageGenerationCard") {
                return {
                    ok: true,
                    result: {
                        success: true,
                        status: "pending_confirmation",
                        cardId: "card-1",
                        prompt: "A test image",
                        modelId: "gpt-5.4-image-2",
                        aspectRatio: "1:1",
                        resolution: "1K",
                        variants: 2,
                        referenceSources: []
                    }
                }
            }
            if (name === "reserveCreditForMessage") {
                reservationAttempts += 1
                if (reservationAttempts === 1) {
                    return { allowed: true, bypassed: false, existing: false, committed: false }
                }
                return {
                    allowed: false,
                    reason: "quota",
                    bypassed: false,
                    existing: false,
                    bucket: "pro",
                    used: 100,
                    limit: 100,
                    remaining: 0
                }
            }
            return null
        })

        await expect(
            confirmPreparedChatImageGenerationHandler(ctx, {
                threadId: "thread-1",
                assistantMessageId: "assistant-message-1",
                toolCallId: "tool-call-1",
                cardId: "card-1"
            })
        ).rejects.toThrow("You only have 0 pro credits remaining for image generation.")

        expect(falQueueSubmitMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "releaseReservedCreditForMessage",
            expect.objectContaining({
                userId: "user-1"
            })
        )
        expect(ctx.runMutation).toHaveBeenCalledWith(
            "patchPreparedImageGenerationToolResult",
            expect.objectContaining({
                threadId: "thread-1",
                messageId: "assistant-message-1",
                toolCallId: "tool-call-1",
                cardId: "card-1",
                update: expect.objectContaining({
                    status: "failed",
                    jobIds: [],
                    error: "You only have 0 pro credits remaining for image generation."
                })
            })
        )
    })

    it("bails out without reserving or submitting when the card is already claimed", async () => {
        const ctx = createCtx()
        ctx.runQuery.mockImplementation(async (name: string) => {
            if (name === "getThreadById") {
                return { _id: "thread-1", authorId: "user-1" }
            }
            return null
        })
        ctx.runMutation.mockImplementation(async (name: string) => {
            // A concurrent confirm already flipped the card to "submitting".
            if (name === "claimPreparedImageGenerationCard") {
                return { ok: false, reason: "not_pending" }
            }
            return null
        })

        await expect(
            confirmPreparedChatImageGenerationHandler(ctx, {
                threadId: "thread-1",
                assistantMessageId: "assistant-message-1",
                toolCallId: "tool-call-1",
                cardId: "card-1"
            })
        ).rejects.toThrow("Image generation card is no longer confirmable.")

        expect(falQueueSubmitMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).not.toHaveBeenCalledWith(
            "reserveCreditForMessage",
            expect.anything()
        )
    })
})
