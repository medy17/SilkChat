import { getMessageWebSearches } from "@/lib/message-web-searches"
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
