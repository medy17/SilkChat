import type { SharedModel } from "./types"

const groqTextAdapters = (modelId: string, openRouterModelId?: string) => [
    `i3-groq:${modelId}`,
    `groq:${modelId}`,
    ...(openRouterModelId ? [`openrouter:${openRouterModelId}`] : [])
]

export const META_MODELS: SharedModel[] = [
    {
        id: "llama-4-scout-17b-16e-instruct",
        name: "Llama 4 Scout 17B 16E",
        shortName: "Llama 4 Scout 17B",
        releaseOrder: 20250404,
        adapters: groqTextAdapters(
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "meta-llama/llama-4-scout"
        ),
        abilities: ["vision"],
        customIcon: "meta"
    },
    {
        id: "llama-4-maverick-17b-128e-instruct",
        name: "Llama 4 Maverick 17B 128E Instruct",
        shortName: "Llama 4 Maverick 17B",
        releaseOrder: 20250405,
        adapters: groqTextAdapters(
            "meta-llama/llama-4-maverick-17b-128e-instruct",
            "meta-llama/llama-4-maverick"
        ),
        abilities: ["vision"],
        customIcon: "meta"
    },
    {
        id: "llama-3-1-8b-instant",
        name: "Llama 3.1 8B Instant",
        shortName: "Llama 3.1 8B",
        releaseOrder: 20240723,
        adapters: groqTextAdapters("llama-3.1-8b-instant"),
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
