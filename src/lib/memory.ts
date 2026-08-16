import type { SupermemoryMemoryEntry } from "@/convex/lib/supermemory_api"

export const filterCurrentMemories = (memories: readonly SupermemoryMemoryEntry[]) =>
    memories.filter((memory) => memory.isLatest && !memory.isForgotten)
