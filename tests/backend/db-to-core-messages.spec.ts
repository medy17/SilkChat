import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUrlMock, fetchMock } = vi.hoisted(() => ({
    getUrlMock: vi.fn(),
    fetchMock: vi.fn()
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
    beforeEach(() => {
        getUrlMock.mockReset().mockResolvedValue("https://files.example/image.png")
        fetchMock.mockReset().mockResolvedValue({
            ok: true,
            arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
            headers: new Headers({
                "content-type": "image/png"
            })
        })
        vi.stubGlobal("fetch", fetchMock)
    })

    it("loads internal image attachments into inline bytes", async () => {
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
            []
        )

        expect(result).toEqual([
            {
                role: "user",
                messageId: "message-1",
                content: [
                    {
                        type: "image",
                        image: new Uint8Array([1, 2, 3]).buffer,
                        mediaType: "image/png"
                    }
                ]
            }
        ])
        expect(fetchMock).toHaveBeenCalledWith("https://files.example/image.png")
    })
})
