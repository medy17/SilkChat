import { describe, expect, it, vi } from "vitest"
import { COMPOSER_TRANSCRIPTION_MODEL } from "../../convex/lib/models/microsoft"
import {
    prepareAudioForTranscription,
    TRANSCRIPTION_SAMPLE_RATE
} from "../../src/lib/audio-transcription"

const createAudioContext = () => ({
    decodeAudioData: vi.fn().mockResolvedValue({
        length: 4,
        numberOfChannels: 2,
        sampleRate: 8_000,
        getChannelData: (channel: number) =>
            channel === 0 ? new Float32Array([0, 0.5, 1, -1]) : new Float32Array([0, -0.5, -1, 1])
    } as AudioBuffer)
})

describe("prepareAudioForTranscription", () => {
    const transcriptionConfig = COMPOSER_TRANSCRIPTION_MODEL.transcription

    it("passes a provider-compatible Ogg recording through byte-for-byte", async () => {
        const audio = new Blob([new Uint8Array([1, 2, 3, 4])], {
            type: "audio/ogg;codecs=opus"
        })
        const audioContext = createAudioContext()

        const prepared = await prepareAudioForTranscription(
            audio,
            audioContext,
            transcriptionConfig
        )

        expect(prepared).toBe(audio)
        expect(audioContext.decodeAudioData).not.toHaveBeenCalled()
    })

    it("normalizes unsupported audio to bounded mono 16 kHz PCM WAV exactly once", async () => {
        const audio = new Blob([new Uint8Array([1, 2, 3, 4])], {
            type: "audio/webm;codecs=opus"
        })
        const audioContext = createAudioContext()

        const prepared = await prepareAudioForTranscription(
            audio,
            audioContext,
            transcriptionConfig
        )
        const bytes = new Uint8Array(await prepared.arrayBuffer())
        const view = new DataView(bytes.buffer)

        expect(prepared.type).toBe("audio/wav")
        expect(prepared.size).toBe(60)
        expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF")
        expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE")
        expect(view.getUint16(22, true)).toBe(1)
        expect(view.getUint32(24, true)).toBe(TRANSCRIPTION_SAMPLE_RATE)
        expect(view.getUint16(34, true)).toBe(16)
        expect(audioContext.decodeAudioData).toHaveBeenCalledTimes(1)

        const preparedAgain = await prepareAudioForTranscription(
            prepared,
            audioContext,
            transcriptionConfig
        )
        expect(preparedAgain).toBe(prepared)
        expect(audioContext.decodeAudioData).toHaveBeenCalledTimes(1)
    })
})
