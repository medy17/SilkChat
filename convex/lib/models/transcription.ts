import type { TranscriptionAudioFormat } from "./types"

export const getTranscriptionAudioFormat = (
    mimeType: string
): TranscriptionAudioFormat | undefined => {
    const normalizedType = mimeType.toLowerCase()
    if (normalizedType.includes("wav")) return "wav"
    if (normalizedType.includes("mpeg") || normalizedType.includes("mp3")) return "mp3"
    if (normalizedType.includes("ogg")) return "ogg"
    if (normalizedType.includes("flac")) return "flac"
    if (normalizedType.includes("webm")) return "webm"
    if (normalizedType.includes("mp4") || normalizedType.includes("m4a")) return "m4a"
    if (normalizedType.includes("aac")) return "aac"
    return undefined
}

export const getTranscriptionMimeType = (format: TranscriptionAudioFormat) => {
    if (format === "mp3") return "audio/mpeg"
    if (format === "m4a") return "audio/mp4"
    return `audio/${format}`
}
