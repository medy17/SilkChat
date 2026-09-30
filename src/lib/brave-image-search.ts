import type { VisualReference } from "./visual-references"

type BraveImageResult = {
    title?: unknown
    url?: unknown
    source?: unknown
    confidence?: unknown
    properties?: { url?: unknown; width?: unknown; height?: unknown }
}

const BRAVE_IMAGE_SEARCH_URL = "https://api.search.brave.com/res/v1/images/search"
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000
const MAX_CACHE_ENTRIES = 500
// Anything shorter than this upscales into a blurry tile, so skip it and let the
// next candidate take its place.
const MIN_IMAGE_EDGE = 200
const searchCache = new Map<string, { visuals: VisualReference[]; fetchedAt: number }>()

const positiveDimension = (value: unknown) => {
    const dimension = typeof value === "string" ? Number(value) : value
    return typeof dimension === "number" && Number.isFinite(dimension) && dimension > 0
        ? Math.round(dimension)
        : undefined
}

const normalizedHttpsUrl = (value: unknown, hostname?: string) => {
    if (typeof value !== "string") return undefined
    try {
        const url = new URL(value)
        if (url.protocol !== "https:" || (hostname && url.hostname !== hostname)) return undefined
        return url.toString()
    } catch {
        return undefined
    }
}

export const parseBraveImageResults = (
    payload: unknown,
    variant: "gallery" | "step",
    limit: number
): VisualReference[] => {
    if (!payload || typeof payload !== "object") return []
    const response = payload as { results?: unknown; extra?: { might_be_offensive?: unknown } }
    if (response.extra?.might_be_offensive === true || !Array.isArray(response.results)) return []

    const acceptedConfidence = variant === "step" ? new Set(["high"]) : new Set(["high", "medium"])
    const visuals: VisualReference[] = []
    const seen = new Set<string>()

    for (const result of response.results as BraveImageResult[]) {
        if (!acceptedConfidence.has(String(result.confidence))) continue
        // Brave's `properties.url` is the original image asset. Returning it lets the
        // browser hotlink the publisher/CDN directly without spending our bandwidth.
        const thumbnailUrl = normalizedHttpsUrl(result.properties?.url)
        const sourceUrl = normalizedHttpsUrl(result.url)
        if (!thumbnailUrl || !sourceUrl || seen.has(thumbnailUrl)) continue
        // Dimensions are optional in Brave's response; unknown sizes pass through.
        const width = positiveDimension(result.properties?.width)
        const height = positiveDimension(result.properties?.height)
        if (width && height && Math.min(width, height) < MIN_IMAGE_EDGE) continue
        seen.add(thumbnailUrl)

        const source = typeof result.source === "string" ? result.source.trim() : ""
        const title = typeof result.title === "string" ? result.title.trim() : ""
        visuals.push({
            id: thumbnailUrl,
            title: title || "Visual reference",
            thumbnailUrl,
            sourceUrl,
            source: source || new URL(sourceUrl).hostname,
            ...(width && height ? { width, height } : {})
        })
        if (visuals.length >= limit) break
    }
    return visuals
}

const pruneCache = () => {
    while (searchCache.size >= MAX_CACHE_ENTRIES) {
        const oldest = searchCache.keys().next().value
        if (typeof oldest !== "string") break
        searchCache.delete(oldest)
    }
}

export const searchBraveImages = async ({
    cue,
    limit,
    variant,
    apiKey
}: {
    cue: string
    limit: number
    variant: "gallery" | "step"
    apiKey: string
}) => {
    const normalizedCue = cue.replace(/\s+/g, " ").trim().slice(0, 160)
    const boundedLimit = Math.min(3, Math.max(1, limit))
    const cacheKey = `${variant}\u0000${normalizedCue}\u0000${boundedLimit}`
    const cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.visuals

    const url = new URL(BRAVE_IMAGE_SEARCH_URL)
    url.searchParams.set("q", normalizedCue)
    url.searchParams.set("count", String(Math.max(8, boundedLimit * 4)))
    url.searchParams.set("country", "ALL")
    url.searchParams.set("safesearch", "strict")

    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "X-Subscription-Token": apiKey
        }
    })
    if (!response.ok) throw new Error(`Brave Image Search returned ${response.status}`)

    const visuals = parseBraveImageResults(await response.json(), variant, boundedLimit)
    pruneCache()
    searchCache.set(cacheKey, { visuals, fetchedAt: Date.now() })
    return visuals
}
