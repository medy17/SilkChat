import type { SupermemoryMemoryEntry } from "@/convex/lib/supermemory_api"
import { filterCurrentMemories, prependMemories, removeMemory, replaceMemory } from "@/lib/memory"
import { describe, expect, it } from "vitest"

const memory = (
    id: string,
    overrides: Partial<SupermemoryMemoryEntry> = {}
): SupermemoryMemoryEntry => ({
    id,
    memory: `Memory ${id}`,
    version: 1,
    isLatest: true,
    isForgotten: false,
    isStatic: true,
    isInference: false,
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    sourceCount: 1,
    ...overrides
})

describe("filterCurrentMemories", () => {
    it("keeps only the latest active version of each memory", () => {
        expect(
            filterCurrentMemories([
                memory("current"),
                memory("superseded", { isLatest: false }),
                memory("forgotten", { isForgotten: true })
            ]).map((entry) => entry.id)
        ).toEqual(["current"])
    })
})

const listPage = (entries: SupermemoryMemoryEntry[], totalItems = entries.length) => ({
    memoryEntries: entries,
    pagination: { currentPage: 1, limit: 20, totalItems, totalPages: 1 }
})

describe("memory list patches", () => {
    const now = "2026-09-28T00:00:00.000Z"

    it("prepends created memories and counts them", () => {
        const next = prependMemories(
            listPage([memory("old")]),
            [{ id: "new", memory: "Likes tea" }],
            now
        )

        expect(next.memoryEntries.map((entry) => entry.id)).toEqual(["new", "old"])
        expect(filterCurrentMemories(next.memoryEntries)[0]).toMatchObject({
            memory: "Likes tea",
            updatedAt: now
        })
        expect(next.pagination.totalItems).toBe(2)
    })

    it("keeps a full page at its limit and rolls the overflow onto a new page", () => {
        const fullPage = {
            memoryEntries: [memory("a"), memory("b")],
            pagination: { currentPage: 1, limit: 2, totalItems: 2, totalPages: 1 }
        }
        const next = prependMemories(fullPage, [{ id: "new", memory: "Likes tea" }], now)

        expect(next.memoryEntries.map((entry) => entry.id)).toEqual(["new", "a"])
        expect(next.pagination).toMatchObject({ totalItems: 3, totalPages: 2 })
    })

    it("drops the trailing page once removal fits everything on fewer pages", () => {
        const firstOfTwo = {
            memoryEntries: [memory("a"), memory("b")],
            pagination: { currentPage: 1, limit: 2, totalItems: 3, totalPages: 2 }
        }

        expect(removeMemory(firstOfTwo, "a").pagination).toMatchObject({
            totalItems: 2,
            totalPages: 1
        })
    })

    it("leaves a refetched page alone when it already has the created memory", () => {
        const refetched = listPage([memory("new"), memory("old")])
        expect(prependMemories(refetched, [{ id: "new", memory: "Likes tea" }], now)).toBe(
            refetched
        )
    })

    it("swaps an edited memory to its new version in place", () => {
        const next = replaceMemory(
            listPage([memory("a"), memory("b"), memory("c")]),
            "b",
            { id: "b2", memory: "Edited" },
            now
        )

        expect(next.memoryEntries.map((entry) => entry.id)).toEqual(["a", "b2", "c"])
        expect(next.memoryEntries[1]).toMatchObject({
            memory: "Edited",
            version: 2,
            parentMemoryId: "b",
            updatedAt: now
        })
    })

    it("removes a forgotten memory and never drops the total below zero", () => {
        const next = removeMemory(listPage([memory("a"), memory("b")], 2), "a")
        expect(next.memoryEntries.map((entry) => entry.id)).toEqual(["b"])
        expect(next.pagination.totalItems).toBe(1)

        expect(removeMemory(listPage([memory("a")], 0), "a").pagination.totalItems).toBe(0)
        expect(removeMemory(listPage([memory("a")]), "missing").pagination.totalItems).toBe(1)
    })
})
