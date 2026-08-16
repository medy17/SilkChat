import { applyPreparedMemoryChange } from "@/convex/lib/supermemory_memory_change"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("prepared hosted memory changes", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("creates an approved memory directly in the V4 memory API", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            Response.json(
                {
                    documentId: "document-1",
                    memories: [{ id: "memory-1", memory: "User likes Pepsi." }]
                },
                { status: 201 }
            )
        )
        vi.stubGlobal("fetch", fetchMock)

        const result = await applyPreparedMemoryChange({
            apiKey: "deployment-key",
            containerTag: "silkchat:user:abc",
            change: {
                operation: "add",
                content: "  User likes Pepsi.  ",
                metadata: { category: "preference" }
            }
        })

        expect(result).toEqual({ operation: "add", memoryId: "memory-1" })
        expect(fetchMock).toHaveBeenCalledOnce()
        const [url, options] = fetchMock.mock.calls[0]
        expect(url).toBe("https://api.supermemory.ai/v4/memories")
        expect(JSON.parse(options.body)).toEqual({
            containerTag: "silkchat:user:abc",
            memories: [
                {
                    content: "User likes Pepsi.",
                    isStatic: true,
                    metadata: { category: "preference" }
                }
            ]
        })
    })
})
