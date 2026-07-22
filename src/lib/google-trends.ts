export type WebTrendSuggestion = {
    query: string
    traffic?: number
    publishedAt?: number
}

export const resolveGoogleTrendsGeo = (languages: readonly string[] = []) => {
    for (const language of languages) {
        try {
            const region = new Intl.Locale(language).maximize().region
            if (region && /^[A-Z]{2}$/.test(region)) return region
        } catch {
            // Ignore malformed browser locale entries and try the next one.
        }
    }

    return "US"
}

const isWebTrendSuggestion = (value: unknown): value is WebTrendSuggestion => {
    if (!value || typeof value !== "object") return false
    const candidate = value as Record<string, unknown>
    return (
        typeof candidate.query === "string" &&
        candidate.query.length > 0 &&
        (candidate.traffic === undefined || typeof candidate.traffic === "number") &&
        (candidate.publishedAt === undefined || typeof candidate.publishedAt === "number")
    )
}

export const parseWebTrendSuggestions = (value: unknown): WebTrendSuggestion[] => {
    if (!value || typeof value !== "object") return []
    const items = (value as { items?: unknown }).items
    return Array.isArray(items) ? items.filter(isWebTrendSuggestion) : []
}

export const fetchWebTrendSuggestions = async (fallbackGeo: string) => {
    const params = new URLSearchParams({ fallbackGeo })
    const response = await fetch(`/api/search-trends?${params.toString()}`)
    if (!response.ok) throw new Error(`Search trends request failed: ${response.status}`)
    return parseWebTrendSuggestions(await response.json())
}

export const buildTrendingSearchPrompt = (query: string) =>
    `Search the web for the latest reliable information about ${query}. Explain why it is trending, summarize what happened, and cite primary sources.`
