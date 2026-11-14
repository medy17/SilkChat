import type { UIMessage } from "ai"
import { maskMarkdownFences, parseTagAttributes } from "./markdown-scan"
import { parseVideoStart, parseYouTubeVideoUrl } from "./youtube-video"

export type VideoContentSegment =
    | { type: "markdown"; content: string }
    | { type: "video"; id: string; start?: number; title?: string }

// What a web search returned about a video; the card shows nothing else about it.
export type KnownVideo = { title?: string; channel?: string; duration?: string }

export const MAX_VIDEO_EMBEDS = 3

const VIDEO_TAG_PATTERN = /^ {0,3}<video\b([^<>\n]*?)(?:\/>|>[ \t]*<\/video\s*>)[ \t]*\r?$/gim

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asText = (value: unknown, maxLength: number) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : ""

// A <video> tag alone on its line, pointing at a YouTube video, becomes a card. Any other
// <video> tag stays ordinary Markdown.
export const splitVideoContent = (content: string, streaming = false): VideoContentSegment[] => {
    const masked = maskMarkdownFences(content)
    let end = content.length
    if (streaming) {
        // Hold a tag that is still being written so it never flashes as raw text.
        const lineStart = content.lastIndexOf("\n") + 1
        const tail = masked.slice(lineStart).trimStart().toLocaleLowerCase()
        if (
            tail &&
            ("<video".startsWith(tail) ||
                (tail.startsWith("<video") && !/(<\/video\s*>|\/>)/.test(tail)))
        ) {
            end = lineStart
        }
    }

    const visible = content.slice(0, end)
    const segments: VideoContentSegment[] = []
    let cursor = 0

    for (const match of masked.slice(0, end).matchAll(VIDEO_TAG_PATTERN)) {
        const attributes = parseTagAttributes(match[1] ?? "")
        const url = attributes.url ?? attributes.src
        const video = typeof url === "string" ? parseYouTubeVideoUrl(url) : undefined
        if (!video) continue

        if (match.index > cursor)
            segments.push({ type: "markdown", content: visible.slice(cursor, match.index) })
        const start = parseVideoStart(asText(attributes.start, 16)) ?? video.start
        const title = asText(attributes.title, 120)
        segments.push({
            type: "video",
            id: video.id,
            ...(start ? { start } : {}),
            ...(title ? { title } : {})
        })
        cursor = match.index + match[0].length
    }

    if (cursor < visible.length) segments.push({ type: "markdown", content: visible.slice(cursor) })
    return segments.filter((segment) => segment.type === "video" || segment.content.trim())
}

// Every video a web search has returned in this conversation, by video ID. A card renders
// only for these, so a URL the model wrote from memory can never be shown.
export const collectKnownVideos = (messages: readonly Pick<UIMessage, "role" | "parts">[]) => {
    const videos = new Map<string, KnownVideo>()

    for (const message of messages) {
        if (message.role !== "assistant") continue
        for (const part of message.parts) {
            if (part.type !== "tool-web_search") continue
            const output = (part as { output?: unknown }).output
            if (!isRecord(output) || !Array.isArray(output.results)) continue

            for (const result of output.results) {
                if (!isRecord(result) || typeof result.url !== "string") continue
                const id = parseYouTubeVideoUrl(result.url)?.id
                if (!id || videos.has(id)) continue

                const details = isRecord(result.video) ? result.video : {}
                const title = asText(result.title, 200)
                const channel = asText(details.channel, 120)
                const duration = asText(details.duration, 16)
                videos.set(id, {
                    ...(title ? { title } : {}),
                    ...(channel ? { channel } : {}),
                    ...(duration ? { duration } : {})
                })
            }
        }
    }

    return videos
}
