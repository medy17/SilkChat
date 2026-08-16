import type { SupermemoryMemoryEntry } from "@/convex/lib/supermemory_api"
import { filterCurrentMemories } from "@/lib/memory"
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
