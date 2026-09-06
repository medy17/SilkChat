import type { SharedModel } from "./types"

// Audition candidate. MESSAGE_SPEECH_MODEL in microsoft.ts remains active.
export const FISH_SPEECH_MODEL = {
    id: "s2.1-pro",
    name: "S2.1 Pro",
    addedOn: "2026-09-06",
    adapters: ["openrouter:fish-audio/s2.1-pro"],
    abilities: [],
    mode: "text-to-speech",
    speech: {
        inputUsdPer1MUtf8Bytes: 15,
        // No fixed voice list on OpenRouter; omit voice to use its default.
        preferredFormat: "pcm",
        pcm: { sampleRate: 44100, channels: 1, bitsPerSample: 16 },
        maxInputCharacters: 1800
    },
    developer: "Fish Audio"
} satisfies SharedModel

export const FISH_AUDIO_MODELS: SharedModel[] = [FISH_SPEECH_MODEL]
