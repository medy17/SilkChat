import type {
    SearchAdapter,
    SearchAdapterConfig,
    SearchOptions,
    SearchResponse,
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
    id?: string
    server_time?: string | null
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

    async search(query: string | string[], options: SearchOptions = {}): Promise<SearchResponse> {
        const {
            limit = 5,
            searchType = "web",
            country,
            contextSize,
            maxTokens = 3000,
            maxTokensPerPage = 600,
            languageFilter,
            domainFilter,
            publishedAfter,
            publishedBefore,
            updatedAfter,
            updatedBefore,
            recency
        } = options
        const maxResults = searchType === "people" ? 50 : 20
        const response = await fetch(this.config.baseUrl!, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.config.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query,
                search_type: searchType,
                max_results: Math.min(Math.max(limit, 1), maxResults),
                ...(country ? { country } : {}),
                ...(contextSize
                    ? { search_context_size: contextSize }
                    : {
                          max_tokens: Math.max(maxTokens, 1),
                          max_tokens_per_page: Math.max(maxTokensPerPage, 1)
                      }),
                ...(languageFilter?.length ? { search_language_filter: languageFilter } : {}),
                ...(domainFilter?.length ? { search_domain_filter: domainFilter } : {}),
                ...(publishedAfter ? { search_after_date_filter: publishedAfter } : {}),
                ...(publishedBefore ? { search_before_date_filter: publishedBefore } : {}),
                ...(updatedAfter ? { last_updated_after_filter: updatedAfter } : {}),
                ...(updatedBefore ? { last_updated_before_filter: updatedBefore } : {}),
                ...(recency ? { search_recency_filter: recency } : {})
            })
        })

        if (!response.ok) {
            throw new Error(`Perplexity search failed: ${response.status} ${response.statusText}`)
        }

        const data: PerplexitySearchResponse = await response.json()
        const results: SearchResult[] = (data.results ?? []).flatMap((result) => {
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

        return {
            results,
            ...(data.id ? { id: data.id } : {}),
            ...(data.server_time !== undefined ? { serverTime: data.server_time } : {})
        }
    }
}
