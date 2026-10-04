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

export type VisualContentSegment =
    | { type: "markdown"; content: string }
    // The cue is what gets searched; the optional title is the card heading.
    | {
          type: "visual"
          cue: string
          title?: string
          refs?: string[]
          itemTitles?: Record<string, string>
      }

// Search budget per recipe and per ordinary reply.
export const MAX_VISUAL_SEARCHES = 3
const STANDALONE_VISUAL_PATTERN =
    /^ {0,3}<visual\b([^<>\n]*?)(?:\/>|>([^<\n]*)<\/visual\s*>)[ \t]*\r?$/im

const normalizeVisualText = (value: unknown, maxLength: number) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : ""

// Presence of a reference always prevents query fallback.
export const parseVisualReferences = (
    attributes: ReturnType<typeof parseTagAttributes>
): string[] | undefined => {
    if (attributes.reference !== undefined) {
        const id = typeof attributes.reference === "string" ? attributes.reference.trim() : ""
        return id && !/\s/.test(id) ? [id] : []
    }
    return undefined
}

export const parseCarouselContent = (
    attributes: string,
    body: string
): Extract<VisualContentSegment, { type: "visual" }> | undefined => {
    const attrs = parseTagAttributes(attributes)
    const title = normalizeVisualText(attrs.title, 120)
    const heading = title ? { title } : {}
    if (attrs.mode === "quick-look") {
        // Mixed or malformed modes must never accidentally trigger a paid search.
        if (body.trim() || attrs.reference !== undefined) return undefined
        const cue = normalizeVisualText(attrs.query, 160)
        return cue ? { type: "visual", cue, ...heading } : undefined
    }
    if (attrs.mode !== "referential") return undefined
    const refs: string[] = []
    const titles: Array<[string, string]> = []
    const remainder = body.replace(
        /<visual\b([^<>]*?)(?:\/>|>([^<]*)<\/visual\s*>)/gi,
        (_match, attributes: string) => {
            const child = parseTagAttributes(attributes)
            const id = parseVisualReferences({ reference: child.reference ?? "" })?.[0]
            if (id && !refs.includes(id) && refs.length < 3) {
                refs.push(id)
                const label = normalizeVisualText(child.title, 120)
                if (label) titles.push([id, label])
            }
            return ""
        }
    )
    if (remainder.trim()) return undefined
    return {
        type: "visual",
        cue: "",
        ...heading,
        refs,
        ...(titles.length ? { itemTitles: Object.fromEntries(titles) } : {})
    }
}

const findCarouselClose = (source: string) => {
    let depth = 0
    for (const tag of source.matchAll(/<(\/?)carousel\b[^<>]*>/gi)) {
        depth += tag[1] ? -1 : /\/>$/.test(tag[0]) ? 0 : 1
        if (depth === 0) return { index: tag.index, length: tag[0].length }
    }
    return undefined
}

// Containers are consumed before their children, so a partial/invalid carousel
// can never leak an inner <visual> into an independent quick-look search.
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
            (["<visual", "<carousel"].some((tag) => tag.startsWith(tail)) ||
                (tail.startsWith("<visual") && !/(<\/visual\s*>|\/>)/.test(tail)))
        ) {
            end = lineStart
        }
    }

    const visible = content.slice(0, end)
    const searchable = masked.slice(0, end)
    const segments: VisualContentSegment[] = []
    let cursor = 0

    const starts = /^ {0,3}<(carousel|visual)\b/gim
    for (let start = starts.exec(searchable); start; start = starts.exec(searchable)) {
        const index = start.index
        const tail = searchable.slice(index)
        let length = 0
        let segment: Extract<VisualContentSegment, { type: "visual" }> | undefined
        if (start[1].toLowerCase() === "carousel") {
            const opening = /^ {0,3}<carousel\b([^<>]*?)(\/?)>/i.exec(tail)
            const closing = findCarouselClose(tail)
            if (!opening || !closing) {
                // A finished malformed container stays ordinary text. Stop scanning
                // its children so they cannot become unintended standalone searches.
                if (!streaming) break
                // Hold an unfinished container, including completed child tags.
                if (index > cursor)
                    segments.push({ type: "markdown", content: visible.slice(cursor, index) })
                cursor = visible.length
                break
            }
            length = closing.index + closing.length
            segment = parseCarouselContent(
                opening[1],
                opening[2] ? "" : tail.slice(opening[0].length, closing.index)
            )
        } else {
            const match = STANDALONE_VISUAL_PATTERN.exec(tail)
            if (match?.index !== 0) continue
            length = match[0].length
            const cue = normalizeVisualText(match[2], 160)
            const attributes = parseTagAttributes(match[1] ?? "")
            const title = normalizeVisualText(attributes.title, 120)
            const refs = parseVisualReferences(attributes)
            if (cue || refs !== undefined)
                segment = {
                    type: "visual",
                    cue,
                    ...(title ? { title } : {}),
                    ...(refs !== undefined ? { refs } : {})
                }
        }
        if (index > cursor)
            segments.push({ type: "markdown", content: visible.slice(cursor, index) })
        if (segment) segments.push(segment)
        cursor = index + length
        starts.lastIndex = cursor
    }

    if (cursor < visible.length) segments.push({ type: "markdown", content: visible.slice(cursor) })
    return segments.filter((segment) => segment.type === "visual" || segment.content.trim())
}
