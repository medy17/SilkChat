// YouTube URL and search-snippet parsing shared by the web search tool and the video card.

const VIDEO_ID_PATTERN = /^[\w-]{11}$/
const YOUTUBE_HOSTS = new Set([
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com"
])
const VIDEO_PATH_PREFIXES = new Set(["shorts", "embed", "live"])

// Accepts plain seconds (532, 532s), clock times (8:52), and YouTube's 8m52s form.
export const parseVideoStart = (value: string | null | undefined) => {
    const text = value?.trim().toLowerCase()
    if (!text) return undefined

    let seconds: number | undefined
    if (/^\d+s?$/.test(text)) {
        seconds = Number.parseInt(text, 10)
    } else if (/^\d+(:\d{1,2}){1,2}$/.test(text)) {
        seconds = text.split(":").reduce((total, part) => total * 60 + Number(part), 0)
    } else {
        const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text)
        if (match)
            seconds =
                Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
    }

    return seconds && Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined
}

// Channel, playlist, and search pages are YouTube URLs but not videos, so they return nothing.
export const parseYouTubeVideoUrl = (value: string): { id: string; start?: number } | undefined => {
    let url: URL
    try {
        url = new URL(value.trim())
    } catch {
        return undefined
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined

    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    const segments = url.pathname.split("/").filter(Boolean)
    let id: string | null | undefined
    if (host === "youtu.be") {
        id = segments[0]
    } else if (YOUTUBE_HOSTS.has(host)) {
        if (segments[0] === "watch") id = url.searchParams.get("v")
        else if (segments[0] && VIDEO_PATH_PREFIXES.has(segments[0])) id = segments[1]
    }
    if (!id || !VIDEO_ID_PATTERN.test(id)) return undefined

    const start = parseVideoStart(url.searchParams.get("t") ?? url.searchParams.get("start"))
    return { id, ...(start ? { start } : {}) }
}

export const canonicalYouTubeUrl = (id: string, start?: number) =>
    `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`

export const formatVideoTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = String(totalSeconds % 60).padStart(2, "0")
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
        : `${minutes}:${seconds}`
}

// Search snippets for videos open with "## Channel" and "##### Mar 19, 2026 (0:03:55)".
// Either line can be missing.
export const parseVideoSnippetHeader = (snippet: string) => {
    const lines = snippet.split("\n", 2).map((line) => line.trim())
    const channel = /^##\s+(\S.*)$/.exec(lines[0] ?? "")?.[1]?.trim()
    const clock = lines
        .map((line) => /^#####\s.*\((\d{1,2}(?::\d{2}){1,2})\)$/.exec(line)?.[1])
        .find(Boolean)
    const seconds = parseVideoStart(clock)
    return {
        ...(channel ? { channel } : {}),
        ...(seconds ? { duration: formatVideoTime(seconds) } : {})
    }
}
