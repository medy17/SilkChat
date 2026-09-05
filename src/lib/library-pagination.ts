export type LibraryCursorHistory = {
    scope: string
    pages: Record<number, string | null>
}

export const getLibraryPageCursor = (history: LibraryCursorHistory, scope: string, page: number) =>
    page === 1 ? null : history.scope === scope ? history.pages[page] : undefined

export const rememberLibraryPageCursor = (
    history: LibraryCursorHistory,
    scope: string,
    page: number,
    cursor: string
): LibraryCursorHistory => ({
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
