import type { SharedModel } from "./types"

// Audition candidate. MESSAGE_SPEECH_MODEL in microsoft.ts remains active.
export const GROK_SPEECH_MODEL = {
    id: "grok-voice-tts-1.0",
    name: "Grok Voice TTS 1.0",
    addedOn: "2026-09-06",
    adapters: ["openrouter:x-ai/grok-voice-tts-1.0"],
    abilities: [],
    mode: "text-to-speech",
    speech: {
        inputUsdPer1MCharacters: 15,
        voice: "eve",
        auditionVoices: ["eve"],
        preferredFormat: "pcm",
        pcm: { sampleRate: 24000, channels: 1, bitsPerSample: 16 },
        maxInputCharacters: 1800
    },
    developer: "xAI"
} satisfies SharedModel

export const XAI_MODELS: SharedModel[] = [
    GROK_SPEECH_MODEL,
    {
        id: "grok-4.6",
        name: "Grok 4.6",
        shortName: "Grok 4.6",
        shortDescription: "xAI reasoning flagship for coding, knowledge work, and STEM",
        description:
            "xAI's latest multimodal reasoning model for coding, knowledge work, and STEM. It combines a 500K-token context with image and file understanding, function calling, structured outputs, and adjustable reasoning effort for demanding analysis and implementation work.",
        addedOn: "2026-08-12",
        releaseOrder: 20260810,
        adapters: ["i3-xai:grok-4.6", "xai:grok-4.6", "openrouter:x-ai/grok-4.6"],
        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
        contextLength: 500_000,
        inputUsdPer1MTokens: 2,
        outputUsdPer1MTokens: 6,
        customIcon: "xai"
    },
    {
        id: "grok-4.5",
        name: "Grok 4.5",
        shortName: "Grok 4.5",
        shortDescription: "Previous xAI flagship for coding, agentic tasks, and knowledge work",
        description:
            "xAI's previous-generation flagship built on the 1.5T V9 foundation. It combines multimodal reasoning, tool use, and a 500K-token context for complex coding, knowledge work, and long-running conversations.",
        addedOn: "2026-07-09",
        releaseOrder: 20260709,
        adapters: ["i3-xai:grok-4.3", "xai:grok-4.3", "openrouter:x-ai/grok-4.5"],
        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
        contextLength: 500_000,
        customIcon: "xai"
    },
    {
        id: "grok-4.3",
        name: "Grok 4.3",
        shortName: "Grok 4.3",
        shortDescription:
            "xAI's previous-generation model for reasoning, vision, and function calling with effort control",
        description:
            "xAI's previous-generation model with strong multimodal reasoning, tool use, and a large context window for complex conversations. Superseded by Grok 4.5.",
        addedOn: "2026-04-30",
        releaseOrder: 20260430,
        adapters: ["i3-xai:grok-4.3", "xai:grok-4.3", "openrouter:x-ai/grok-4.3"],
        openrouterProvider: "x-ai",
        abilities: ["reasoning", "vision", "function_calling", "effort_control"],
        contextLength: 1_000_000,
        customIcon: "xai"
    },
    {
        id: "grok-4-1-fast",
        name: "Grok 4.1 Fast",
        shortName: "Grok 4.1 Fast",
        shortDescription: "Long-context tool caller built to search, act, and answer at speed",
        description:
            "Grok 4.1 Fast was xAI's production-minded agent model, trained for rapid, accurate tool use across real customer-support, finance, and research workflows. Its two-million-token context let it sustain long multi-turn jobs without surrendering the speed that earned the name.",
        releaseOrder: 20260321,
        adapters: [
            "i3-xai:grok-4-1-fast-non-reasoning",
            "i3-xai:grok-4-1-fast-reasoning",
            "xai:grok-4-1-fast-non-reasoning",
            "xai:grok-4-1-fast-reasoning",
            "openrouter:x-ai/grok-4.1-fast"
        ],
        abilities: ["reasoning", "function_calling"],
        contextLength: 2_000_000,
        supportsDisablingReasoning: true,
        customIcon: "xai",
        legacy: true,
        sunsetOn: "2026-05-15",
        replacementId: "grok-4.3"
    },
    {
        id: "grok-4.20-0309",
        name: "Grok 4.20 0309",
        shortName: "Grok 4.20",
        shortDescription:
            "xAI's previous generation model meant to be xAI's first foray into flagship tier reasoning, and agentic workflows.",
        description:
            "xAI's previous generation model meant to be xAI's first foray into flagship tier reasoning, and agentic workflows. Excels at tool use with a 200K-token context window, and multimodal support. It stays fast by default while still letting you enable deeper reasoning when you need more deliberate analysis.",
        releaseOrder: 20250309,
        addedOn: "2026-03-26",
        adapters: [
            "i3-xai:grok-4.20-0309-non-reasoning",
            "i3-xai:grok-4.20-0309-reasoning",
            "xai:grok-4.20-0309-non-reasoning",
            "xai:grok-4.20-0309-reasoning",
            "openrouter:x-ai/grok-4.20"
        ],
        abilities: ["reasoning", "function_calling"],
        supportsDisablingReasoning: true,
        customIcon: "xai"
    }
]
