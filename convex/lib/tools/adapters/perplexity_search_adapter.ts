import type {
    SearchAdapter,
    SearchAdapterConfig,
    SearchOptions,
    SearchResult
} from "./search_adapter"

interface PerplexitySearchResponse {
    results?: Array<{
        title?: string
        url?: string
        snippet?: string
        date?: string
        last_updated?: string
    }>
}

export interface PerplexitySearchConfig extends SearchAdapterConfig {
    apiKey: string
    baseUrl?: string
}

export class PerplexitySearchAdapter implements SearchAdapter {
    readonly name = "perplexity"
    private config: PerplexitySearchConfig

    constructor(config: PerplexitySearchConfig) {
        this.config = {
            baseUrl: "https://api.perplexity.ai/search",
            ...config
        }
    }

    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const { limit = 5, maxTokens = 3000, maxTokensPerPage = 600 } = options
        const response = await fetch(this.config.baseUrl!, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.config.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query,
                max_results: Math.min(Math.max(limit, 1), 20),
                max_tokens: Math.max(maxTokens, 1),
                max_tokens_per_page: Math.max(maxTokensPerPage, 1)
            })
        })

        if (!response.ok) {
            throw new Error(`Perplexity search failed: ${response.status} ${response.statusText}`)
        }

        const data: PerplexitySearchResponse = await response.json()
        return (data.results ?? []).flatMap((result) => {
            if (!result.url) return []

            return [
                {
                    url: result.url,
                    title: result.title?.trim() || result.url,
                    snippet: result.snippet?.trim() || "",
                    ...(result.date && { date: result.date }),
                    ...(result.last_updated && { lastUpdated: result.last_updated })
                }
            ]
        })
    }
}
