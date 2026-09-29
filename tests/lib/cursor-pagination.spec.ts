import { describe, expect, it } from "vitest"
import { getPageCursor, rememberPageCursor, type CursorHistory } from "@/lib/cursor-pagination"

describe("cursor history", () => {
    it("retains previous page boundaries and invalidates future ones on a new traversal", () => {
        let history: CursorHistory = { scope: "active", pages: { 1: null } }
        history = rememberPageCursor(history, "active", 2, "second")
        history = rememberPageCursor(history, "active", 3, "third")
        expect(getPageCursor(history, "active", 2)).toBe("second")
        history = rememberPageCursor(history, "active", 2, "updated-second")
        expect(getPageCursor(history, "active", 2)).toBe("updated-second")
        expect(getPageCursor(history, "active", 3)).toBeUndefined()
    })

    it("never reuses a cursor across users, filters, sort orders or page sizes", () => {
        const history = { scope: "old-query", pages: { 1: null, 2: "old-cursor" } }
        expect(getPageCursor(history, "new-query", 2)).toBeUndefined()
        expect(getPageCursor(history, "new-query", 1)).toBeNull()
        const next = rememberPageCursor(history, "new-query", 2, "new-cursor")
        expect(next.pages).toEqual({ 1: null, 2: "new-cursor" })
    })

    it("requires restarting numeric deep links when no cursor has been visited", () => {
        const history = { scope: "active", pages: { 1: null } }
        expect(getPageCursor(history, "active", 99)).toBeUndefined()
    })
})
