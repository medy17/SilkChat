import { maskMarkdownFences, parseTagAttributes } from "./markdown-scan"

export type VisualReference = {
    id: string
    title: string
    thumbnailUrl: string
    sourceUrl: string
    source: string
    // Original asset size when Brave reports it, so layouts can be solved before loading.
    width?: number
    height?: number
}

const completedSearches = new Map<string, VisualReference[]>()

export const buildVisualSearchUrl = (cue: string, limit: number, variant: "gallery" | "step") => {
    const parameters = new URLSearchParams({
        q: cue,
        limit: String(Math.min(3, Math.max(1, limit))),
        variant
    })
    return `/api/visual-references?${parameters}`
}

export const searchVisualReferences = async (
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

    const response = await fetch(buildVisualSearchUrl(normalizedCue, boundedLimit, variant), {
        headers: { Accept: "application/json" },
        signal
    })
    if (!response.ok) throw new Error(`Image search failed with ${response.status}`)

    const payload = (await response.json()) as { visuals?: unknown }
    const results = Array.isArray(payload.visuals)
        ? payload.visuals.filter(isVisualReference).slice(0, boundedLimit)
        : []
    completedSearches.set(cacheKey, results)
    return results
}

const isVisualReference = (value: unknown): value is VisualReference => {
    if (!value || typeof value !== "object") return false
    const visual = value as Partial<VisualReference>
    return (
        typeof visual.id === "string" &&
        typeof visual.title === "string" &&
        typeof visual.thumbnailUrl === "string" &&
        typeof visual.sourceUrl === "string" &&
        typeof visual.source === "string"
    )
}

export type VisualContentSegment =
    | { type: "markdown"; content: string }
    // The cue is what gets searched; the optional title is the card heading.
    | { type: "visual"; cue: string; title?: string }

// Search budget per recipe and per ordinary reply.
export const MAX_VISUAL_SEARCHES = 3
const STANDALONE_VISUAL_PATTERN = /^ {0,3}<visual\b([^>\n]*)>([^<\n]*)<\/visual\s*>[ \t]*$/gim

const normalizeVisualText = (value: unknown, maxLength: number) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : ""

// Lifts standalone <visual> lines out of prose, outside code fences. While streaming,
// an unfinished visual line is held back so its markup never flashes as text.
export const splitVisualContent = (content: string, streaming = false): VisualContentSegment[] => {
    // Masking is line-by-line, so a prefix of the mask is the mask of the prefix.
    const masked = maskMarkdownFences(content)
    let end = content.length
    if (streaming) {
        const lineStart = content.lastIndexOf("\n") + 1
        // Code lines mask to blanks, so an unfinished example in a fence stays visible.
        const tail = masked.slice(lineStart).trimStart().toLocaleLowerCase()
        if (
            tail &&
            ("<visual".startsWith(tail) ||
                (tail.startsWith("<visual") && !/<\/visual\s*>/.test(tail)))
        ) {
            end = lineStart
        }
    }

    const visible = content.slice(0, end)
    const searchable = masked.slice(0, end)
    const segments: VisualContentSegment[] = []
    let cursor = 0

    for (const match of searchable.matchAll(STANDALONE_VISUAL_PATTERN)) {
        const index = match.index ?? 0
        if (index > cursor)
            segments.push({ type: "markdown", content: visible.slice(cursor, index) })
        const cue = normalizeVisualText(match[2], 160)
        const title = normalizeVisualText(parseTagAttributes(match[1] ?? "").title, 120)
        if (cue) segments.push({ type: "visual", cue, ...(title ? { title } : {}) })
        cursor = index + match[0].length
    }

    if (cursor < visible.length) segments.push({ type: "markdown", content: visible.slice(cursor) })
    return segments.filter((segment) => segment.type === "visual" || segment.content.trim())
}
