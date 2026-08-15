import { afterEach, describe, expect, it, vi } from "vitest"
import { WebSearchAdapter } from "../../convex/lib/tools/web_search"

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
            max_results: 8,
            max_tokens: 4000,
            max_tokens_per_page: 600
        })
    })
})
