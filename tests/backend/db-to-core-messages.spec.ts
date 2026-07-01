import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getUrlMock } = vi.hoisted(() => ({
    getUrlMock: vi.fn()
}))

vi.mock("@convex-dev/r2", () => ({
    R2: class {
        getUrl = getUrlMock
    }
}))

vi.mock("../../convex/_generated/api", () => ({
    components: {
        r2: "r2"
    }
}))

import { dbMessagesToCore } from "../../convex/lib/db_to_core_messages"

describe("dbMessagesToCore", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    beforeEach(() => {
        getUrlMock.mockReset().mockResolvedValue("https://files.example/image.png")
    })

    it("uses the direct public asset URL for internal image attachments when provided", async () => {
        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "attachments/user-1/image.png",
                            filename: "image.png",
                            mimeType: "image/png"
                        }
                    ]
                }
            ] as never,
            [],
            {
                publicAssetBaseUrl: "https://convex.example"
            }
        )

        expect(result).toEqual([
            {
                role: "user",
                messageId: "message-1",
                content: [
                    {
                        type: "image",
                        image: "https://convex.example/attachments/user-1/image.png",
                        mediaType: "image/png"
                    }
                ]
            }
        ])
        expect(getUrlMock).not.toHaveBeenCalled()
    })

    it("passes native pdf attachments through as direct public file URLs", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "attachments/user-1/report.pdf",
                            filename: "report.pdf",
                            mimeType: "application/pdf"
                        }
                    ]
                }
            ] as never,
            ["native_pdf"] as never,
            {
                publicAssetBaseUrl: "https://r2.example.com"
            }
        )

        expect(fetchMock).not.toHaveBeenCalled()
        expect(result).toEqual([
            {
                role: "user",
                messageId: "message-1",
                content: [
                    {
                        type: "file",
                        mediaType: "application/pdf",
                        filename: "report.pdf",
                        data: "https://r2.example.com/attachments/user-1/report.pdf"
                    }
                ]
            }
        ])
    })

    it("rewrites absolute proxy attachment URLs to direct public asset URLs", async () => {
        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "https://convex.example/r2?key=attachments%2Fuser-1%2Freport.pdf",
                            filename: "report.pdf",
                            mimeType: "application/pdf"
                        }
                    ]
                }
            ] as never,
            ["native_pdf"] as never,
            {
                publicAssetBaseUrl: "https://r2.example.com"
            }
        )

        expect(result).toEqual([
            {
                role: "user",
                messageId: "message-1",
                content: [
                    {
                        type: "file",
                        mediaType: "application/pdf",
                        filename: "report.pdf",
                        data: "https://r2.example.com/attachments/user-1/report.pdf"
                    }
                ]
            }
        ])
    })

    it("fails loudly when an internal attachment is missing a public asset base URL", async () => {
        await expect(
            dbMessagesToCore(
                [
                    {
                        messageId: "message-1",
                        role: "user",
                        parts: [
                            {
                                type: "file",
                                data: "attachments/user-1/report.pdf",
                                filename: "report.pdf",
                                mimeType: "application/pdf"
                            }
                        ]
                    }
                ] as never,
                ["native_pdf"] as never
            )
        ).rejects.toThrow("R2_PUBLIC_BASE_URL is required")
    })

    it("injects completed SilkScreen generations as model-visible image context", async () => {
        const resolveGeneratedImageContextUrl = vi.fn().mockResolvedValue({
            url: "https://r2.example.com/references/user-1/generated-context/context.webp",
            mediaType: "image/webp"
        })
        const result = await dbMessagesToCore(
            [
                {
                    messageId: "assistant-1",
                    role: "assistant",
                    parts: [
                        {
                            type: "tool-invocation",
                            toolInvocation: {
                                state: "result",
                                toolCallId: "call-image",
                                toolName: "prepareImageGeneration",
                                args: {
                                    prompt: "A sunset naval battle"
                                },
                                result: {
                                    success: true,
                                    kind: "prepared_image_generation",
                                    status: "completed",
                                    prompt: "A sunset naval battle",
                                    assets: [
                                        {
                                            storageKey: "generations/user-1/generated.png",
                                            imageUrl: "generations/user-1/generated.png"
                                        }
                                    ],
                                    referenceSources: [
                                        {
                                            id: "image_ref_1",
                                            key: "attachments/user-1/private.png"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            ] as never,
            ["vision"] as never,
            {
                publicAssetBaseUrl: "https://r2.example.com",
                resolveGeneratedImageContextUrl
            }
        )

        expect(result).toEqual([
            {
                role: "assistant",
                messageId: "assistant-1-tool-call",
                content: [
                    {
                        type: "tool-call",
                        toolCallId: "call-image",
                        toolName: "prepareImageGeneration",
                        input: {
                            prompt: "A sunset naval battle"
                        }
                    }
                ]
            },
            {
                role: "tool",
                messageId: "assistant-1-tool-result",
                content: [
                    {
                        type: "tool-result",
                        toolCallId: "call-image",
                        toolName: "prepareImageGeneration",
                        output: {
                            type: "json",
                            value: {
                                success: true,
                                kind: "prepared_image_generation",
                                status: "completed",
                                prompt: "A sunset naval battle",
                                assets: [
                                    {
                                        storageKey: "generations/user-1/generated.png",
                                        imageUrl: "generations/user-1/generated.png"
                                    }
                                ]
                            }
                        }
                    }
                ]
            },
            {
                role: "user",
                messageId: "assistant-1-generated-image-context",
                content: [
                    {
                        type: "text",
                        text: "SilkScreen generated this image from the prompt: A sunset naval battle"
                    },
                    {
                        type: "image",
                        image: "https://r2.example.com/references/user-1/generated-context/context.webp",
                        mediaType: "image/webp"
                    }
                ]
            }
        ])
        expect(resolveGeneratedImageContextUrl).toHaveBeenCalledWith(
            "generations/user-1/generated.png"
        )
    })
})
