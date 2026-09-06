import { MESSAGE_SPEECH_MODEL } from "./models/microsoft"

const model = MESSAGE_SPEECH_MODEL.adapters
    .find((adapter) => adapter.startsWith("openrouter:"))
    ?.slice("openrouter:".length)
if (!model) throw new Error("Read-aloud model requires an OpenRouter adapter")

export const MESSAGE_SPEECH = {
    model,
    voice: MESSAGE_SPEECH_MODEL.speech.voice,
    format: MESSAGE_SPEECH_MODEL.speech.preferredFormat,
    sampleRate: MESSAGE_SPEECH_MODEL.speech.pcm.sampleRate,
    chunkCharacters: MESSAGE_SPEECH_MODEL.speech.maxInputCharacters,
    version: 1,
    timeoutMs: 15 * 60 * 1000
} as const
