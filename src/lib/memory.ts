import type {
    SupermemoryMemoryEntry,
    SupermemoryMemoryListResponse
} from "@/convex/lib/supermemory_api"

export const filterCurrentMemories = (memories: readonly SupermemoryMemoryEntry[]) =>
    memories.filter((memory) => memory.isLatest && !memory.isForgotten)

type SavedMemory = { id: string; memory: string }

// Keeps a patched page consistent with what the server would return: at most `limit`
// entries, with `totalPages` derived from the new total.
const withEntries = (
    page: SupermemoryMemoryListResponse,
    memoryEntries: SupermemoryMemoryEntry[],
    totalItems: number
): SupermemoryMemoryListResponse => {
    const { limit } = page.pagination
    const safeTotal = Math.max(0, totalItems)

    return {
        memoryEntries: memoryEntries.slice(0, limit),
        pagination: {
            ...page.pagination,
            totalItems: safeTotal,
            totalPages: Math.max(1, Math.ceil(safeTotal / limit))
        }
    }
}

// Patches reflect a mutation on a list page. Each is a no-op when the page already
// reflects it, so they can run on a refetched page as well as the stale one.
export const prependMemories = (
    page: SupermemoryMemoryListResponse,
    saved: readonly SavedMemory[],
    now = new Date().toISOString()
): SupermemoryMemoryListResponse => {
    const created = saved.filter(
        (entry) => !page.memoryEntries.some((existing) => existing.id === entry.id)
    )
    if (created.length === 0) return page

    return withEntries(
        page,
        [
            ...created.map((entry) => ({
                id: entry.id,
                memory: entry.memory,
                version: 1,
                isLatest: true,
                isForgotten: false,
                isStatic: true,
                isInference: false,
                createdAt: now,
                updatedAt: now,
                sourceCount: 0
            })),
            ...page.memoryEntries
        ],
        page.pagination.totalItems + created.length
    )
}

// Supermemory versions an edit under a new id, so swap the entry rather than mutate it.
export const replaceMemory = (
    page: SupermemoryMemoryListResponse,
    previousId: string,
    updated: SavedMemory,
    now = new Date().toISOString()
): SupermemoryMemoryListResponse => ({
    ...page,
    memoryEntries: page.memoryEntries.map((entry) =>
        entry.id === previousId
            ? {
                  ...entry,
                  id: updated.id,
                  memory: updated.memory,
                  version: entry.version + 1,
                  parentMemoryId: entry.id,
                  updatedAt: now
              }
            : entry
    )
})

export const removeMemory = (
    page: SupermemoryMemoryListResponse,
    memoryId: string
): SupermemoryMemoryListResponse => {
    const memoryEntries = page.memoryEntries.filter((entry) => entry.id !== memoryId)
    const removed = page.memoryEntries.length - memoryEntries.length
    if (removed === 0) return page

    return withEntries(page, memoryEntries, page.pagination.totalItems - removed)
}
