import type { VisualReference } from "./visual-references"

type BraveImageResult = {
    title?: unknown
    url?: unknown
    source?: unknown
    confidence?: unknown
    page_fetched?: unknown
    thumbnail?: { src?: unknown }
    properties?: { url?: unknown; width?: unknown; height?: unknown }
}

const BRAVE_IMAGE_SEARCH_URL = "https://api.search.brave.com/res/v1/images/search"
// Anything shorter than this upscales into a blurry tile, so skip it and let the
// next candidate take its place.
const MIN_IMAGE_EDGE = 200

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
    variant: "gallery" | "step" | "inspect",
    limit: number
): VisualReference[] => {
    if (!payload || typeof payload !== "object") return []
    const response = payload as { results?: unknown; extra?: { might_be_offensive?: unknown } }
    if (response.extra?.might_be_offensive === true || !Array.isArray(response.results)) return []

    const acceptedConfidence = new Set(
        variant === "step"
            ? ["high"]
            : variant === "inspect"
              ? ["high", "medium", "low"]
              : ["high", "medium"]
    )
    const visuals: VisualReference[] = []
    const seen = new Set<string>()

    for (const result of response.results as BraveImageResult[]) {
        if (!acceptedConfidence.has(String(result.confidence))) continue
        // properties.url is the publisher asset; thumbnail.src is Brave's proxy.
        // Capture the publisher version first, then use the proxy as a fallback.
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

// Candidate search deliberately relies on Brave's normal caching. Persistent
// message results, not a process-local cache, prevent repeat work on replay.
export const searchBraveImageCandidates = async (
    cue: string,
    variant: "gallery" | "step" | "inspect",
    apiKey: string
) => {
    const url = new URL(BRAVE_IMAGE_SEARCH_URL)
    url.search = new URLSearchParams({
        q: cue,
        count: "12",
        country: "ALL",
        safesearch: "strict"
    }).toString()
    const response = await fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
        signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) throw new Error(`Brave Image Search returned ${response.status}`)
    const payload = (await response.json()) as {
        results?: BraveImageResult[]
        query?: { altered?: string; show_strict_warning?: boolean }
    }
    const candidates = parseBraveImageResults(payload, variant, 8).map((visual) => {
        const result = payload.results?.find(
            (result) => normalizedHttpsUrl(result.properties?.url) === visual.thumbnailUrl
        )
        const fallbackUrl = normalizedHttpsUrl(result?.thumbnail?.src, "imgs.search.brave.com")
        return {
            ...visual,
            ...(fallbackUrl ? { fallbackUrl } : {}),
            confidence: String(result?.confidence ?? "unknown"),
            ...(typeof result?.page_fetched === "string"
                ? { pageFetched: result.page_fetched }
                : {})
        }
    })
    return {
        candidates,
        ...(payload.query?.altered ? { alteredQuery: payload.query.altered } : {}),
        strictWarning: payload.query?.show_strict_warning === true
    }
}
