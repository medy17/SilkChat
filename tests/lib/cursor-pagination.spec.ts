import { describe, expect, it } from "vitest"
import {
    assemblePageChunks,
    getPageChunkRequestKey,
    getPageCursor,
    rememberPageCursor,
    type CursorHistory,
    type PageChunk
} from "@/lib/cursor-pagination"

describe("page chunk assembly", () => {
    const assemble = (chunks: Record<string, PageChunk<number>>) =>
        assemblePageChunks<number>(null, 5, (request) => chunks[getPageChunkRequestKey(request)])

    it("continues short chunks until the page is full and ends on the last chunk's cursor", () => {
        const chunks = {
            "5:": { page: [1], isDone: false, continueCursor: "a" },
            "4:a": { page: [], isDone: false, continueCursor: "b" },
            "4:b": { page: [2, 3, 4, 5], isDone: false, continueCursor: "c" }
        }
        expect(assemble(chunks)).toEqual({
            requests: [
                { cursor: null, numItems: 5 },
                { cursor: "a", numItems: 4 },
                { cursor: "b", numItems: 4 }
            ],
            page: { page: [1, 2, 3, 4, 5], isDone: false, continueCursor: "c" }
        })
    })

    it("asks for the next chunk and withholds a partial page until it arrives", () => {
        const result = assemble({ "5:": { page: [1, 2], isDone: false, continueCursor: "a" } })
        expect(result.page).toBeUndefined()
        expect(result.requests.at(-1)).toEqual({ cursor: "a", numItems: 3 })
    })

    it("completes a short page once the results end", () => {
        expect(
            assemble({
                "5:": { page: [1], isDone: false, continueCursor: "a" },
                "4:a": { page: [2], isDone: true, continueCursor: "end" }
            }).page
        ).toEqual({ page: [1, 2], isDone: true, continueCursor: "end" })
    })
})

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
