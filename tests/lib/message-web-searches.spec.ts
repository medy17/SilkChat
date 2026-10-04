import { getMessageWebSearches, getMessageImageSearches } from "@/lib/message-web-searches"
import { describe, expect, it } from "vitest"

describe("getMessageWebSearches", () => {
    it("collects searches in message order with their results", () => {
        const result = getMessageWebSearches({
            role: "assistant",
            parts: [
                { type: "text", text: "Looking this up." },
                {
                    type: "tool-web_search",
                    toolCallId: "search-1",
                    state: "output-available",
                    input: { query: "  first query  " },
                    output: {
                        success: true,
                        results: [
                            {
                                title: "First result",
                                url: "https://example.com",
                                snippet: "Useful context"
                            }
                        ]
                    }
                },
                {
                    type: "tool-web_search",
                    toolCallId: "search-2",
                    state: "input-available",
                    input: { query: "second query" }
                }
            ]
        } as never)

        expect(result).toEqual([
            {
                toolCallId: "search-1",
                query: "first query",
                results: [
                    {
                        title: "First result",
                        url: "https://example.com",
                        description: undefined,
                        snippet: "Useful context"
                    }
                ],
                error: undefined,
                status: "succeeded"
            },
            {
                toolCallId: "search-2",
                query: "second query",
                results: [],
                error: undefined,
                status: "running"
            }
        ])
    })

    it("marks provider and tool errors as failed", () => {
        const result = getMessageWebSearches({
            role: "assistant",
            parts: [
                {
                    type: "tool-web_search",
                    toolCallId: "search-1",
                    state: "output-available",
                    input: { query: "first query" },
                    output: { success: false, error: "Search provider failed", results: [] }
                },
                {
                    type: "tool-web_search",
                    toolCallId: "search-2",
                    state: "output-error",
                    input: { query: "second query" },
                    errorText: "Tool failed"
                }
            ]
        } as never)

        expect(result.map(({ status, error }) => ({ status, error }))).toEqual([
            { status: "failed", error: "Search provider failed" },
            { status: "failed", error: "Tool failed" }
        ])
    })

    it("shows every query in a multi-query search instead of a generic placeholder", () => {
        const result = getMessageWebSearches({
            role: "assistant",
            parts: [
                {
                    type: "tool-web_search",
                    toolCallId: "search-1",
                    state: "output-available",
                    input: {
                        query: [" broad current topic ", "official announcement", "  "]
                    },
                    output: { success: true, results: [] }
                }
            ]
        } as never)

        expect(result[0]?.query).toBe("2 queries: broad current topic · official announcement")
    })

    it("leaves malformed calls to the shared tool-failure card", () => {
        const result = getMessageWebSearches({
            role: "assistant",
            parts: [
                {
                    type: "tool-web_search",
                    toolCallId: "search-1",
                    state: "output-error",
                    input: {},
                    errorText: "Invalid input for tool web_search"
                }
            ]
        } as never)

        expect(result).toEqual([])
    })
})

describe("getMessageImageSearches", () => {
    it("maps publisher attribution rather than the temporary candidate URL", () => {
        const [search] = getMessageImageSearches({
            role: "assistant",
            parts: [
                {
                    type: "tool-image_search",
                    toolCallId: "search",
                    state: "output-available",
                    input: { query: "frog" },
                    output: {
                        success: true,
                        results: [
                            {
                                title: " Fossil ",
                                source: " Museum ",
                                sourceUrl: " https://museum.test/fossil ",
                                thumbnailUrl: "https://temp.test/expired.webp"
                            }
                        ]
                    }
                }
            ]
        })
        expect(search.status).toBe("succeeded")
        expect(search.results).toEqual([
            expect.objectContaining({
                title: "Fossil",
                source: "Museum",
                url: "https://museum.test/fossil"
            })
        ])
    })

    it.each([
        {
            name: "running",
            part: { state: "input-available" },
            status: "running",
            error: undefined
        },
        {
            name: "provider failure",
            part: { state: "output-available", output: { success: false } },
            status: "failed",
            error: "Search unavailable. Try again."
        },
        {
            name: "tool failure",
            part: { state: "output-error", errorText: "Search timed out" },
            status: "failed",
            error: "Search timed out"
        }
    ])("maps $name to activity state", ({ part, status, error }) => {
        const [search] = getMessageImageSearches({
            role: "assistant",
            parts: [
                {
                    type: "tool-image_search",
                    toolCallId: "search",
                    input: { query: "frog" },
                    ...part
                }
            ]
        } as never)
        expect(search).toMatchObject({ status, error, query: "frog", results: [] })
    })
})
