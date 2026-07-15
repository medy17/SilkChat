import { afterEach, describe, expect, it, vi } from "vitest"
import { PerplexitySearchAdapter } from "../../convex/lib/tools/adapters/perplexity_search_adapter"

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("PerplexitySearchAdapter", () => {
    it("returns one bounded snippet field per valid source", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    results: [
                        {
                            title: " Current result ",
                            url: "https://example.com/current",
                            snippet: " Concise extracted context. ",
                            date: "2026-07-15",
                            last_updated: "2026-07-15"
                        },
                        { title: "Missing URL", snippet: "Ignored" }
                    ]
                }),
                { status: 200 }
            )
        )
        vi.stubGlobal("fetch", fetchMock)

        const adapter = new PerplexitySearchAdapter({ apiKey: "pplx-key" })
        const results = await adapter.search("current example", {
            limit: 5,
            maxTokens: 3000,
            maxTokensPerPage: 600
        })

        expect(results).toEqual([
            {
                title: "Current result",
                url: "https://example.com/current",
                snippet: "Concise extracted context.",
                date: "2026-07-15",
                lastUpdated: "2026-07-15"
            }
        ])
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            max_results: 5,
            max_tokens: 3000,
            max_tokens_per_page: 600
        })
    })

    it("maps upstream failures to a useful error", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 429, statusText: "Too Many Requests" }))
        )

        const adapter = new PerplexitySearchAdapter({ apiKey: "pplx-key" })

        await expect(adapter.search("rate limited")).rejects.toThrow(
            "Perplexity search failed: 429 Too Many Requests"
        )
    })
})
