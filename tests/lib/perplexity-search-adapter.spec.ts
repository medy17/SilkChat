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
                    id: "request-1",
                    server_time: "2026-09-16T12:00:00Z",
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

        expect(results).toEqual({
            results: [
                {
                    title: "Current result",
                    url: "https://example.com/current",
                    snippet: "Concise extracted context.",
                    date: "2026-07-15",
                    lastUpdated: "2026-07-15"
                }
            ],
            id: "request-1",
            serverTime: "2026-09-16T12:00:00Z"
        })
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            max_results: 5,
            max_tokens: 3000,
            max_tokens_per_page: 600
        })
    })

    it("forwards people, region, language, domain, and time refinements", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ results: [], server_time: null }), { status: 200 })
            )
        vi.stubGlobal("fetch", fetchMock)

        const adapter = new PerplexitySearchAdapter({ apiKey: "pplx-key" })
        await adapter.search(["Stripe engineering leadership", "Stripe CTO"], {
            searchType: "people",
            limit: 50,
            country: "US",
            contextSize: "high",
            languageFilter: ["en"],
            domainFilter: ["linkedin.com", "stripe.com"],
            publishedAfter: "01/01/2025",
            publishedBefore: "09/01/2026",
            updatedAfter: "08/01/2026",
            updatedBefore: "09/15/2026"
        })

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            query: ["Stripe engineering leadership", "Stripe CTO"],
            search_type: "people",
            max_results: 50,
            country: "US",
            search_context_size: "high",
            search_language_filter: ["en"],
            search_domain_filter: ["linkedin.com", "stripe.com"],
            search_after_date_filter: "01/01/2025",
            search_before_date_filter: "09/01/2026",
            last_updated_after_filter: "08/01/2026",
            last_updated_before_filter: "09/15/2026"
        })
    })

    it("maps upstream failures to a useful error", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    new Response(null, { status: 429, statusText: "Too Many Requests" })
                )
        )

        const adapter = new PerplexitySearchAdapter({ apiKey: "pplx-key" })

        await expect(adapter.search("rate limited")).rejects.toThrow(
            "Perplexity search failed: 429 Too Many Requests"
        )
    })
})
