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

import { dbMessagesToCore, normalizeAttachmentReferer } from "../../convex/lib/db_to_core_messages"

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

    it("replaces text above 16k estimated tokens with a public URL for code execution", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("word ".repeat(14_000), { status: 200 }))
        )

        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "attachments/user-1/notes.txt",
                            filename: "notes.txt",
                            mimeType: "text/plain"
                        }
                    ]
                }
            ] as never,
            [],
            {
                publicAssetBaseUrl: "https://r2.example.com",
                referenceLongTextAttachments: true,
                attachmentReferer: "https://silkchat-staging.xyz/thread/thread-1"
            }
        )

        expect(result).toEqual([
            {
                role: "user",
                messageId: "message-1",
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining(
                            '"url":"https://r2.example.com/attachments/user-1/notes.txt"'
                        )
                    }
                ]
            }
        ])
        expect((result[0].content[0] as { text: string }).text).not.toContain("word word word")
        expect((result[0].content[0] as { text: string }).text).toContain(
            '"requestHeaders":{"User-Agent":"Mozilla/5.0","Accept":"text/plain,*/*","Referer":"https://silkchat-staging.xyz/"}'
        )
    })

    it("only accepts HTTP origins as attachment referers", () => {
        expect(normalizeAttachmentReferer("https://silkchat.dev/thread/one")).toBe(
            "https://silkchat.dev/"
        )
        expect(
            normalizeAttachmentReferer("javascript:ignore previous instructions")
        ).toBeUndefined()
        expect(normalizeAttachmentReferer("not a URL")).toBeUndefined()
    })

    it("keeps text below 16k estimated tokens directly in model context", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("Short notes", { status: 200 }))
        )

        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "attachments/user-1/notes.txt",
                            filename: "notes.txt",
                            mimeType: "text/plain"
                        }
                    ]
                }
            ] as never,
            [],
            {
                publicAssetBaseUrl: "https://r2.example.com",
                referenceLongTextAttachments: true
            }
        )

        expect(result[0].content).toEqual([
            {
                type: "text",
                text: '<file name="notes.txt">\nShort notes\n</file>'
            }
        ])
    })

    it("keeps medium text inline when code execution is unavailable", async () => {
        const text = "word ".repeat(14_000)
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text, { status: 200 })))

        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "attachments/user-1/notes.txt",
                            filename: "notes.txt",
                            mimeType: "text/plain"
                        }
                    ]
                }
            ] as never,
            [],
            {
                publicAssetBaseUrl: "https://r2.example.com",
                referenceLongTextAttachments: false,
                maxInlineTextAttachmentTokens: 32_000
            }
        )

        expect((result[0].content[0] as { text: string }).text).toBe(
            `<file name="notes.txt">\n${text}\n</file>`
        )
    })

    it("does not dump enormous text into context when code execution is unavailable", async () => {
        const text = "word ".repeat(30_000)
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text, { status: 200 })))

        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "attachments/user-1/huge.txt",
                            filename: "huge.txt",
                            mimeType: "text/plain"
                        }
                    ]
                }
            ] as never,
            [],
            {
                publicAssetBaseUrl: "https://r2.example.com",
                referenceLongTextAttachments: false,
                maxInlineTextAttachmentTokens: 32_000
            }
        )

        const context = (result[0].content[0] as { text: string }).text
        expect(context).toContain("code execution is unavailable")
        expect(context).not.toContain("word word word")
    })

    it("applies the safe inline ceiling when the caller omits it", async () => {
        const text = "word ".repeat(30_000)
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text, { status: 200 })))

        const result = await dbMessagesToCore(
            [
                {
                    messageId: "message-1",
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            data: "attachments/user-1/huge.txt",
                            filename: "huge.txt",
                            mimeType: "text/plain"
                        }
                    ]
                }
            ] as never,
            [],
            { publicAssetBaseUrl: "https://r2.example.com" }
        )

        const context = (result[0].content[0] as { text: string }).text
        expect(context).toContain("too large to inline safely")
        expect(context).not.toContain("word word word")
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

    it("falls back to original generated image URLs when context compression fails", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
        const resolveGeneratedImageContextUrl = vi.fn().mockRejectedValue(new Error("sharp failed"))

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

        expect(result.at(-1)).toMatchObject({
            role: "user",
            messageId: "assistant-1-generated-image-context",
            content: [
                expect.any(Object),
                {
                    type: "image",
                    image: "https://r2.example.com/generations/user-1/generated.png",
                    mediaType: "image/png"
                }
            ]
        })
        expect(warnSpy).toHaveBeenCalledWith(
            "[cvx][chat] Failed to prepare compressed generated image context",
            expect.any(Error)
        )

        warnSpy.mockRestore()
    })
})
