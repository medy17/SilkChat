import { describe, expect, it } from "vitest"
import {
    getLibraryPageCursor,
    rememberLibraryPageCursor,
    type LibraryCursorHistory
} from "@/lib/library-pagination"

describe("library cursor history", () => {
    it("retains previous page boundaries and invalidates future ones on a new traversal", () => {
        let history: LibraryCursorHistory = { scope: "active", pages: { 1: null } }
        history = rememberLibraryPageCursor(history, "active", 2, "second")
        history = rememberLibraryPageCursor(history, "active", 3, "third")
        expect(getLibraryPageCursor(history, "active", 2)).toBe("second")
        history = rememberLibraryPageCursor(history, "active", 2, "updated-second")
        expect(getLibraryPageCursor(history, "active", 2)).toBe("updated-second")
        expect(getLibraryPageCursor(history, "active", 3)).toBeUndefined()
    })

    it("never reuses a cursor across users, filters, sort orders or page sizes", () => {
        const history = { scope: "old-query", pages: { 1: null, 2: "old-cursor" } }
        expect(getLibraryPageCursor(history, "new-query", 2)).toBeUndefined()
        expect(getLibraryPageCursor(history, "new-query", 1)).toBeNull()
        const next = rememberLibraryPageCursor(history, "new-query", 2, "new-cursor")
        expect(next.pages).toEqual({ 1: null, 2: "new-cursor" })
    })

    it("requires restarting numeric deep links when no cursor has been visited", () => {
        const history = { scope: "active", pages: { 1: null } }
        expect(getLibraryPageCursor(history, "active", 99)).toBeUndefined()
    })
})
