export type RecipeVisual = {
    id: string
    title: string
    thumbnailUrl: string
    sourceUrl: string
    source: string
}

const completedSearches = new Map<string, RecipeVisual[]>()

export const buildBraveImageSearchUrl = (
    cue: string,
    limit: number,
    variant: "gallery" | "step"
) => {
    const parameters = new URLSearchParams({
        q: cue,
        limit: String(Math.min(3, Math.max(1, limit))),
        variant
    })
    return `/api/recipe-visuals?${parameters}`
}

export const searchRecipeVisuals = async (
    cue: string,
    limit: number,
    variant: "gallery" | "step",
    signal?: AbortSignal
) => {
    const normalizedCue = cue.replace(/\s+/g, " ").trim().slice(0, 160)
    if (!normalizedCue) return []
    const boundedLimit = Math.min(3, Math.max(1, limit))
    const cacheKey = `${variant}\u0000${normalizedCue}\u0000${boundedLimit}`
    const cached = completedSearches.get(cacheKey)
    if (cached) return cached

    const response = await fetch(buildBraveImageSearchUrl(normalizedCue, boundedLimit, variant), {
        headers: { Accept: "application/json" },
        signal
    })
    if (!response.ok) throw new Error(`Image search failed with ${response.status}`)

    const payload = (await response.json()) as { visuals?: unknown }
    const results = Array.isArray(payload.visuals)
        ? payload.visuals.filter(isRecipeVisual).slice(0, boundedLimit)
        : []
    completedSearches.set(cacheKey, results)
    return results
}

const isRecipeVisual = (value: unknown): value is RecipeVisual => {
    if (!value || typeof value !== "object") return false
    const visual = value as Partial<RecipeVisual>
    return (
        typeof visual.id === "string" &&
        typeof visual.title === "string" &&
        typeof visual.thumbnailUrl === "string" &&
        typeof visual.sourceUrl === "string" &&
        typeof visual.source === "string"
    )
}
