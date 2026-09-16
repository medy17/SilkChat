export interface SearchResult {
    url: string
    title: string
    snippet: string
    date?: string
    lastUpdated?: string
}

export interface SearchOptions {
    limit?: number
    searchType?: "web" | "people"
    country?: string
    contextSize?: "low" | "medium" | "high"
    maxTokens?: number
    maxTokensPerPage?: number
    languageFilter?: string[]
    domainFilter?: string[]
    publishedAfter?: string
    publishedBefore?: string
    updatedAfter?: string
    updatedBefore?: string
    recency?: "hour" | "day" | "week" | "month" | "year"
}

export interface SearchResponse {
    results: SearchResult[]
    id?: string
    serverTime?: string | null
}

export interface SearchAdapter {
    readonly name: string
    search(query: string | string[], options?: SearchOptions): Promise<SearchResponse>
}

export interface SearchAdapterConfig {
    apiKey?: string
    baseUrl?: string
}
