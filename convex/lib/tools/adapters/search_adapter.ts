export interface SearchResult {
    url: string
    title: string
    snippet: string
    date?: string
    lastUpdated?: string
}

export interface SearchOptions {
    limit?: number
    maxTokens?: number
    maxTokensPerPage?: number
}

export interface SearchAdapter {
    readonly name: string
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>
}

export interface SearchAdapterConfig {
    apiKey?: string
    baseUrl?: string
}
