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

export const MESSAGE_SPEECH_MODEL = {
    id: "mai-voice-2",
    name: "MAI-Voice-2",
    addedOn: "2026-09-06",
    releaseOrder: 20260906,
    adapters: ["openrouter:microsoft/mai-voice-2"],
    abilities: [],
    mode: "text-to-speech",
    speech: {
        inputUsdPer1MCharacters: 22,
        voice: "en-US-Harper:MAI-Voice-2",
        preferredFormat: "pcm",
        // Verified through OpenRouter on 2026-09-06: signed 16-bit mono PCM at 24 kHz.
        pcm: { sampleRate: 24000, channels: 1, bitsPerSample: 16 },
        maxInputCharacters: 1800
    },
    developer: "Microsoft"
} satisfies SharedModel

export const MICROSOFT_MODELS: SharedModel[] = [COMPOSER_TRANSCRIPTION_MODEL, MESSAGE_SPEECH_MODEL]
