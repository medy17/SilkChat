import type { SharedModel } from "./types"

export const META_MODELS: SharedModel[] = [
    {
        id: "llama-4-scout-17b-16e-instruct",
        name: "Llama 4 Scout 17B 16E",
        shortName: "Llama 4 Scout 17B",
        releaseOrder: 20250404,
        adapters: [
            "i3-groq:meta-llama/llama-4-scout-17b-16e-instruct",
            "groq:meta-llama/llama-4-scout-17b-16e-instruct"
        ],
        abilities: ["vision"],
        customIcon: "meta"
    },
    {
        id: "llama-4-maverick-17b-128e-instruct",
        name: "Llama 4 Maverick 17B 128E Instruct",
        shortName: "Llama 4 Maverick 17B",
        releaseOrder: 20250405,
        adapters: ["groq:meta-llama/llama-4-maverick-17b-128e-instruct"],
        abilities: ["vision"],
        customIcon: "meta"
    },
    {
        id: "llama-3-1-8b-instant",
        name: "Llama 3.1 8B Instant",
        shortName: "Llama 3.1 8B",
        releaseOrder: 20240723,
        adapters: ["i3-groq:llama-3.1-8b-instant", "groq:llama-3.1-8b-instant"],
        abilities: [],
        customIcon: "meta"
    },
    {
        id: "whisper-large-v3-turbo",
        name: "Whisper Large v3 Turbo",
        releaseOrder: 20240301,
        adapters: ["groq:whisper-large-v3-turbo"],
        abilities: [],
        mode: "speech-to-text"
    }
]
