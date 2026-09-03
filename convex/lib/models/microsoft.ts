import type { SharedModel } from "./types"

export const COMPOSER_TRANSCRIPTION_MODEL = {
    id: "mai-transcribe-2",
    name: "MAI-Transcribe 2",
    addedOn: "2026-09-03",
    releaseOrder: 20260903,
    adapters: ["openrouter:microsoft/mai-transcribe-2"],
    abilities: [],
    mode: "speech-to-text",
    // Verified against OpenRouter's Azure route on 2026-09-03. WebM and M4A were rejected.
    transcription: {
        preferredFormat: "wav",
        acceptedFormats: ["wav", "mp3", "ogg", "flac"]
    },
    developer: "Microsoft"
} satisfies SharedModel

export const MICROSOFT_MODELS: SharedModel[] = [COMPOSER_TRANSCRIPTION_MODEL]
