import {
    canonicalYouTubeUrl,
    formatVideoTime,
    parseVideoSnippetHeader,
    parseYouTubeVideoUrl
} from "@/lib/youtube-video"
import type { SearchResult } from "./adapters/search_adapter"

export type VideoSearchResult = SearchResult & {
    video?: { id: string; channel?: string; duration?: string }
}

type VideoLookup = { available: boolean; channel?: string; duration?: string }

const LOOKUP_TIMEOUT_MS = 2500
// YouTube's oEmbed answers for a video that was removed, made private, or cannot be embedded.
const UNAVAILABLE_STATUSES = new Set([401, 403, 404])

const getYouTubeApiKey = () => process.env.YOUTUBE_API_KEY?.trim()

type YouTubeVideoItem = {
    id?: string
    snippet?: { channelTitle?: string }
    status?: { embeddable?: boolean; privacyStatus?: string }
    contentDetails?: {
        duration?: string
        regionRestriction?: { allowed?: string[]; blocked?: string[] }
    }
}

const parseIsoDuration = (value: string | undefined) => {
    const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "")
    if (!match) return undefined
    const seconds =
        Number(match[1] ?? 0) * 86_400 +
        Number(match[2] ?? 0) * 3600 +
        Number(match[3] ?? 0) * 60 +
        Number(match[4] ?? 0)
    return seconds > 0 ? formatVideoTime(seconds) : undefined
}

// A video lists either the only countries it plays in or the countries it is blocked in.
const playsIn = (item: YouTubeVideoItem, country: string | undefined) => {
    const restriction = item.contentDetails?.regionRestriction
    if (!country || !restriction) return true
    if (restriction.allowed) return restriction.allowed.includes(country)
    return !restriction.blocked?.includes(country)
}

// One request covers every video in a search. A video missing from the answer no longer
// exists. Returns nothing when the API cannot be reached, so the caller can fall back.
const lookUpWithDataApi = async (
    ids: string[],
    apiKey: string,
    country: string | undefined
): Promise<Map<string, VideoLookup> | undefined> => {
    try {
        const params = new URLSearchParams({
            part: "snippet,status,contentDetails",
            fields: "items(id,snippet(channelTitle),status(embeddable,privacyStatus),contentDetails(duration,regionRestriction))",
            id: ids.join(","),
            maxResults: "50",
            key: apiKey
        })
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
            signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
        })
        if (!response.ok) {
            console.error("YouTube video lookup failed:", response.status)
            return undefined
        }

        const data = (await response.json()) as { items?: YouTubeVideoItem[] }
        const items = new Map((data.items ?? []).map((item) => [item.id, item]))
        return new Map(
            ids.map((id): [string, VideoLookup] => {
                const item = items.get(id)
                if (!item) return [id, { available: false }]
                const channel = item.snippet?.channelTitle?.trim()
                const duration = parseIsoDuration(item.contentDetails?.duration)
                return [
                    id,
                    {
                        available:
                            item.status?.embeddable !== false &&
                            item.status?.privacyStatus !== "private" &&
                            playsIn(item, country),
                        ...(channel ? { channel } : {}),
                        ...(duration ? { duration } : {})
                    }
                ]
            })
        )
    } catch (error) {
        console.error("YouTube video lookup failed:", error)
        return undefined
    }
}

// Keyless fallback. It cannot see region blocks.
const lookUpWithOEmbed = async (id: string): Promise<VideoLookup> => {
    try {
        const response = await fetch(
            `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalYouTubeUrl(id))}`,
            { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) }
        )
        if (UNAVAILABLE_STATUSES.has(response.status)) return { available: false }
        if (!response.ok) return { available: true }
        const data = (await response.json()) as { author_name?: unknown }
        const channel = typeof data.author_name === "string" ? data.author_name.trim() : ""
        return { available: true, ...(channel ? { channel } : {}) }
    } catch {
        // A slow or failed lookup must not hide a result that may well be playable.
        return { available: true }
    }
}

const lookUpVideos = async (ids: string[], country: string | undefined) => {
    const apiKey = getYouTubeApiKey()
    const lookups = apiKey ? await lookUpWithDataApi(ids.slice(0, 50), apiKey, country) : undefined
    if (lookups) return lookups
    return new Map(
        await Promise.all(
            ids.map(async (id): Promise<[string, VideoLookup]> => [id, await lookUpWithOEmbed(id)])
        )
    )
}

// Search indexes lag behind YouTube: results keep tracking parameters, repeat a video under
// several URLs, and outlive the video itself. Every video result leaves here with a clean
// URL and its channel and duration. Videos that can no longer be played, or that are blocked
// in the user's country, are dropped.
export const normalizeVideoResults = async (
    results: SearchResult[],
    { country }: { country?: string } = {}
): Promise<VideoSearchResult[]> => {
    const videoIds = results.map((result) => parseYouTubeVideoUrl(result.url)?.id)
    const uniqueIds = [...new Set(videoIds.filter((id) => id !== undefined))]
    if (uniqueIds.length === 0) return results

    const lookups = await lookUpVideos(uniqueIds, country)
    const seen = new Set<string>()
    return results.flatMap((result, index): VideoSearchResult[] => {
        const id = videoIds[index]
        if (!id) return [result]
        if (seen.has(id)) return []
        seen.add(id)

        const lookup = lookups.get(id) ?? { available: true }
        if (!lookup.available) return []

        const header = parseVideoSnippetHeader(result.snippet)
        const channel = lookup.channel ?? header.channel
        const duration = lookup.duration ?? header.duration
        return [
            {
                ...result,
                url: canonicalYouTubeUrl(id),
                video: {
                    id,
                    ...(channel ? { channel } : {}),
                    ...(duration ? { duration } : {})
                }
            }
        ]
    })
}
