import { tool } from "ai"
import { z } from "zod"
import type { ToolAdapter } from "../toolkit"
import { PerplexitySearchAdapter } from "./adapters"
import { getDeploymentSearchApiKey } from "./availability"

export const WebSearchAdapter: ToolAdapter = async (params) => {
    if (!params.enabledTools.includes("web_search")) return {}
    if (!params.toolAvailability.web_search.enabled) return {}

    const apiKey = getDeploymentSearchApiKey()
    if (!apiKey) return {}

    return {
        web_search: tool({
            description:
                "Search the web for current information and return concise, source-linked results.",
            inputSchema: z.object({
                query: z.string().min(1).describe("A focused web search query")
            }),
            execute: async ({ query }) => {
                try {
                    const search = new PerplexitySearchAdapter({ apiKey })
                    const results = await search.search(query, {
                        limit: 8,
                        maxTokens: 4000,
                        maxTokensPerPage: 600
                    })

                    return {
                        success: true,
                        query,
                        results,
                        count: results.length
                    }
                } catch (error) {
                    console.error("Web search error:", error)
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error occurred",
                        query,
                        results: []
                    }
                }
            }
        })
    }
}
