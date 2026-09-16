import { afterEach, describe, expect, it, vi } from "vitest"
import { WebSearchAdapter, webSearchInputSchema } from "../../convex/lib/tools/web_search"

afterEach(() => {
    Reflect.deleteProperty(process.env, "PERPLEXITY_API_KEY")
    vi.unstubAllGlobals()
})

describe("WebSearchAdapter", () => {
    it("uses the bounded multi-source search budget", async () => {
        process.env.PERPLEXITY_API_KEY = "pplx-key"
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), {
                status: 200
            })
        )
        vi.stubGlobal("fetch", fetchMock)

        const tools = await WebSearchAdapter({
            enabledTools: ["web_search"],
            toolAvailability: {
                web_search: { enabled: true, fundingSource: "deployment" },
                code_execution: { enabled: false, fundingSource: "none" },
                mathematical_instruments: { enabled: true, fundingSource: "none" },
                supermemory: { enabled: false, fundingSource: "none" }
            },
            userSettings: {} as never,
            ctx: {} as never
        })

        await tools.web_search?.execute?.({ query: "current search topic" }, {} as never)

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            search_type: "web",
            max_results: 8,
            max_tokens: 4000,
            max_tokens_per_page: 600
        })
    })

    it("accepts focused people lookups and the complete refinement surface", () => {
        expect(
            webSearchInputSchema.safeParse({
                query: ["Stripe engineering leaders", "Stripe VP Engineering"],
                searchType: "people",
                maxResults: 50,
                country: "US",
                languages: ["en"],
                domains: ["linkedin.com", ".jobs"]
            }).success
        ).toBe(true)
        expect(
            webSearchInputSchema.safeParse({
                query: "government climate policy",
                domains: [".gov", ".edu"]
            }).success
        ).toBe(true)
        expect(
            webSearchInputSchema.safeParse({
                query: "government climate policy",
                domains: ["-.gov", "-reddit.com"]
            }).success
        ).toBe(true)

        expect(
            webSearchInputSchema.safeParse({
                query: "latest AI releases",
                maxResults: 50,
                contextSize: "high",
                maxTokens: 4000,
                recency: "week",
                publishedAfter: "09/01/2026",
                domains: ["openai.com", "-reddit.com"]
            }).success
        ).toBe(true)
    })

    it("normalizes incompatible refinements instead of trapping the model in retries", async () => {
        process.env.PERPLEXITY_API_KEY = "pplx-key"
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), {
                status: 200
            })
        )
        vi.stubGlobal("fetch", fetchMock)

        const tools = await WebSearchAdapter({
            enabledTools: ["web_search"],
            toolAvailability: {
                web_search: { enabled: true, fundingSource: "deployment" },
                code_execution: { enabled: false, fundingSource: "none" },
                mathematical_instruments: { enabled: true, fundingSource: "none" },
                supermemory: { enabled: false, fundingSource: "none" }
            },
            userSettings: {} as never,
            ctx: {} as never
        })

        await tools.web_search?.execute?.(
            {
                query: ["latest release", "official announcement"],
                searchType: "web",
                maxResults: 50,
                contextSize: "high",
                maxTokens: 12_000,
                maxTokensPerPage: 4_000,
                domains: ["openai.com", "-reddit.com"],
                publishedAfter: "09/01/2026",
                recency: "week"
            },
            {} as never
        )

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            query: ["latest release", "official announcement"],
            search_type: "web",
            max_results: 20,
            search_context_size: "high",
            search_domain_filter: ["openai.com"],
            search_after_date_filter: "09/01/2026"
        })
    })
})
