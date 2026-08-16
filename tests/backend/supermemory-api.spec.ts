import {
    deleteSupermemoryContainer,
    getSupermemoryContainerTag,
    getSupermemoryConversationCustomId,
    listAllSupermemoryMemories
} from "@/convex/lib/supermemory_api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const memoryEntry = (id: string, isForgotten = false) => ({
    id,
    memory: `Memory ${id}`,
    version: 1,
    isLatest: true,
    isForgotten,
    isStatic: true,
    isInference: false,
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    sourceCount: 1
})

describe("hosted Supermemory API", () => {
    beforeEach(() => {
        process.env.SUPERMEMORY_API_KEY = "deployment-key"
        process.env.SUPERMEMORY_CONTAINER_PREFIX = "silkchat-test"
    })

    afterEach(() => {
        Reflect.deleteProperty(process.env, "SUPERMEMORY_API_KEY")
        Reflect.deleteProperty(process.env, "SUPERMEMORY_CONTAINER_PREFIX")
        vi.unstubAllGlobals()
    })

    it("derives a stable opaque container tag without exposing the user id", async () => {
        const first = await getSupermemoryContainerTag("auth-user@example.com")
        const second = await getSupermemoryContainerTag("auth-user@example.com")

        expect(first).toBe(second)
        expect(first).toMatch(/^silkchat-test:user:[a-f0-9]{48}$/)
        expect(first).not.toContain("auth-user")
    })

    it("derives an opaque stable conversation id scoped to the thread", async () => {
        const first = await getSupermemoryConversationCustomId("user-1", "thread-1")
        const second = await getSupermemoryConversationCustomId("user-1", "thread-1")
        const differentThread = await getSupermemoryConversationCustomId("user-1", "thread-2")

        expect(first).toBe(second)
        expect(first).toMatch(/^silkchat-test:chat:[a-f0-9]{48}$/)
        expect(first).not.toContain("user-1")
        expect(first).not.toContain("thread-1")
        expect(differentThread).not.toBe(first)
    })

    it("exports every active memory across paginated hosted results", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json({
                    memoryEntries: [memoryEntry("one"), memoryEntry("forgotten", true)],
                    pagination: { currentPage: 1, limit: 50, totalItems: 3, totalPages: 2 }
                })
            )
            .mockResolvedValueOnce(
                Response.json({
                    memoryEntries: [memoryEntry("two")],
                    pagination: { currentPage: 2, limit: 50, totalItems: 3, totalPages: 2 }
                })
            )
        vi.stubGlobal("fetch", fetchMock)

        const result = await listAllSupermemoryMemories("user-1")

        expect(result.map((memory) => memory.id)).toEqual(["one", "two"])
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ page: 2 })
    })

    it("treats an already-deleted account container as successfully removed", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    Response.json({ message: "Container not found" }, { status: 404 })
                )
        )

        await expect(deleteSupermemoryContainer("user-1")).resolves.toBeUndefined()
    })

    it("fails export and deletion when hosted memory credentials are unavailable", async () => {
        Reflect.deleteProperty(process.env, "SUPERMEMORY_API_KEY")

        await expect(listAllSupermemoryMemories("user-1")).rejects.toThrow(
            "Memory is unavailable, so the account export could not be completed."
        )
        await expect(deleteSupermemoryContainer("user-1")).rejects.toThrow(
            "Memory is unavailable, so account deletion could not be completed."
        )
    })
})
