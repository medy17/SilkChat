export type CursorHistory = {
    scope: string
    pages: Record<number, string | null>
}

export const getPageCursor = (history: CursorHistory, scope: string, page: number) =>
    page === 1 ? null : history.scope === scope ? history.pages[page] : undefined

export type PageChunk<T> = {
    page: T[]
    isDone: boolean
    continueCursor: string
}

export type PageChunkRequest = {
    cursor: string | null
    numItems: number
}

export const getPageChunkRequestKey = (request: PageChunkRequest) =>
    `${request.numItems}:${request.cursor ?? ""}`

/**
 * A server page can end short when its read budget runs out. Chain
 * continuation chunks until the visible page is full or the results end,
 * so a short page never reaches the screen. `requests` lists every chunk
 * needed so far; `page` is set once the page is complete.
 */
export const assemblePageChunks = <T>(
    startCursor: string | null,
    pageSize: number,
    getChunk: (request: PageChunkRequest) => PageChunk<T> | undefined
): { requests: PageChunkRequest[]; page?: PageChunk<T> } => {
    const requests: PageChunkRequest[] = [{ cursor: startCursor, numItems: pageSize }]
    const items: T[] = []

    while (true) {
        const chunk = getChunk(requests[requests.length - 1])
        if (!chunk) return { requests }

        items.push(...chunk.page)
        if (chunk.isDone || items.length >= pageSize) {
            return {
                requests,
                page: { page: items, isDone: chunk.isDone, continueCursor: chunk.continueCursor }
            }
        }
        requests.push({ cursor: chunk.continueCursor, numItems: pageSize - items.length })
    }
}

export const rememberPageCursor = (
    history: CursorHistory,
    scope: string,
    page: number,
    cursor: string
): CursorHistory => ({
    scope,
    pages: {
        // A refreshed earlier page may have a new boundary. Discard later
        // boundaries rather than reusing cursors from a different sequence.
        ...Object.fromEntries(
            Object.entries(history.scope === scope ? history.pages : {}).filter(
                ([number]) => Number(number) < page
            )
        ),
        1: null,
        [page]: cursor
    }
})
