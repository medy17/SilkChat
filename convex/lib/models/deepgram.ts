import type { SharedModel } from "./types"

// Audition candidate. MESSAGE_SPEECH_MODEL in microsoft.ts remains active.
export const FLUX_SPEECH_MODEL = {
    id: "flux-tts-free",
    name: "Flux TTS (free)",
    addedOn: "2026-09-06",
    adapters: ["openrouter:deepgram/flux-tts:free"],
    abilities: [],
    mode: "text-to-speech",
    speech: {
        inputUsdPer1MCharacters: 0,
        voice: "flux-elise-en",
        auditionVoices: ["flux-elise-en", "flux-kelsey-en", "flux-sienna-en", "flux-alexis-en"],
        preferredFormat: "pcm",
        pcm: { sampleRate: 24000, channels: 1, bitsPerSample: 16 },
        maxInputCharacters: 1800
    },
    developer: "Deepgram"
} satisfies SharedModel

export const DEEPGRAM_MODELS: SharedModel[] = [FLUX_SPEECH_MODEL]
