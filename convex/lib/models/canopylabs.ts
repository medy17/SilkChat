import type { SharedModel } from "./types"

// Audition candidate. MESSAGE_SPEECH_MODEL in microsoft.ts remains active.
export const ORPHEUS_SPEECH_MODEL = {
    id: "orpheus-3b-0.1-ft",
    name: "Orpheus 3B",
    addedOn: "2026-09-06",
    adapters: ["openrouter:canopylabs/orpheus-3b-0.1-ft"],
    abilities: [],
    mode: "text-to-speech",
    speech: {
        // OpenRouter catalog rate. DeepInfra may be cheaper than the Together route.
        inputUsdPer1MCharacters: 15,
        voice: "tara",
        auditionVoices: ["tara"],
        preferredFormat: "pcm",
        pcm: { sampleRate: 24000, channels: 1, bitsPerSample: 16 },
        maxInputCharacters: 1800
    },
    developer: "Canopy Labs"
} satisfies SharedModel

export const CANOPYLABS_MODELS: SharedModel[] = [ORPHEUS_SPEECH_MODEL]
