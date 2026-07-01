import { beforeEach, describe, expect, it, vi } from "vitest"

const { r2GetMetadataMock, r2GetUrlMock, r2StoreMock } = vi.hoisted(() => ({
    r2GetMetadataMock: vi.fn(),
    r2GetUrlMock: vi.fn(),
    r2StoreMock: vi.fn()
}))

vi.mock("../../convex/attachments", () => ({
    r2: {
        getMetadata: r2GetMetadataMock,
        getUrl: r2GetUrlMock,
        store: r2StoreMock
    }
}))

import { resolveGeneratedImageContextUrl } from "../../convex/lib/image_generation/context_images_node"

const createCtx = () => ({}) as never

describe("generated image context resolver", () => {
    beforeEach(() => {
        r2GetMetadataMock.mockReset().mockImplementation(async (_ctx: unknown, key: string) => {
            if (key === "generations/user-1/small.png") {
                return {
                    authorId: "user-1",
                    type: "image/png",
                    size: 256 * 1024
                }
            }
            if (key === "generations/user-1/huge.png") {
                return {
                    authorId: "user-1",
                    type: "image/png",
                    size: 8 * 1024 * 1024
                }
            }
            if (key.startsWith("references/user-1/generated-context/")) {
                return null
            }
            return null
        })
        r2GetUrlMock.mockReset().mockImplementation(async (key: string) => {
            return `https://signed.example.com/${encodeURIComponent(key)}`
        })
        r2StoreMock
            .mockReset()
            .mockImplementation(
                async (_ctx: unknown, _bytes: unknown, options: { key: string }) => options.key
            )
    })

    it("uses the original public URL for small generated image context", async () => {
        await expect(
            resolveGeneratedImageContextUrl(createCtx(), {
                userId: "user-1",
                storageKey: "generations/user-1/small.png",
                publicAssetBaseUrl: "https://r2.example.com"
            })
        ).resolves.toEqual({
            url: "https://r2.example.com/generations/user-1/small.png",
            mediaType: "image/png"
        })

        expect(r2StoreMock).not.toHaveBeenCalled()
        expect(r2GetUrlMock).not.toHaveBeenCalled()
    })

    it("creates a compressed derivative for oversized generated image context", async () => {
        const png1x1 = Uint8Array.from([
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8,
            6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 255, 255,
            63, 0, 5, 254, 2, 254, 167, 53, 129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
        ])
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(png1x1, {
                status: 200,
                headers: { "Content-Type": "image/png" }
            })
        )
        vi.stubGlobal("fetch", fetchMock)

        const ctx = createCtx()
        const result = await resolveGeneratedImageContextUrl(ctx, {
            userId: "user-1",
            storageKey: "generations/user-1/huge.png",
            publicAssetBaseUrl: "https://r2.example.com"
        })

        const derivativeKey = r2StoreMock.mock.calls[0]?.[2].key
        expect(derivativeKey).toMatch(
            /^references\/user-1\/generated-context\/[a-f0-9]{32}-[a-f0-9]+\.webp$/
        )
        expect(result).toEqual({
            url: `https://r2.example.com/${derivativeKey}`,
            mediaType: "image/webp"
        })
        expect(fetchMock).toHaveBeenCalledWith(
            "https://signed.example.com/generations%2Fuser-1%2Fhuge.png",
            expect.objectContaining({
                headers: expect.objectContaining({ Accept: "image/*" })
            })
        )
        expect(r2StoreMock).toHaveBeenCalledWith(
            ctx,
            expect.any(Uint8Array),
            expect.objectContaining({
                authorId: "user-1",
                key: derivativeKey,
                type: "image/webp"
            })
        )
    })
})
