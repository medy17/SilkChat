import { getTranscriptionAudioFormat } from "@/convex/lib/models/transcription"
import type { TranscriptionConfig } from "@/convex/lib/models/types"

export const TRANSCRIPTION_SAMPLE_RATE = 16_000
export const MAX_TRANSCRIPTION_AUDIO_BYTES = 25 * 1024 * 1024

const writeAscii = (view: DataView, offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index))
    }
}

const encodeMonoPcm16Wav = (samples: Float32Array, sampleRate: number) => {
    const bytesPerSample = 2
    const wavBuffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
    const view = new DataView(wavBuffer)

    writeAscii(view, 0, "RIFF")
    view.setUint32(4, wavBuffer.byteLength - 8, true)
    writeAscii(view, 8, "WAVE")
    writeAscii(view, 12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * bytesPerSample, true)
    view.setUint16(32, bytesPerSample, true)
    view.setUint16(34, 16, true)
    writeAscii(view, 36, "data")
    view.setUint32(40, samples.length * bytesPerSample, true)

    for (let index = 0; index < samples.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, samples[index]))
        view.setInt16(
            44 + index * bytesPerSample,
            sample < 0 ? sample * 0x8000 : sample * 0x7fff,
            true
        )
    }

    return new Blob([wavBuffer], { type: "audio/wav" })
}

const downmixAndResample = (audioBuffer: AudioBuffer, targetSampleRate: number) => {
    if (audioBuffer.length === 0 || audioBuffer.numberOfChannels === 0) {
        throw new Error("No decodable audio data was recorded.")
    }

    const outputLength = Math.max(
        1,
        Math.round((audioBuffer.length * targetSampleRate) / audioBuffer.sampleRate)
    )
    if (44 + outputLength * 2 > MAX_TRANSCRIPTION_AUDIO_BYTES) {
        throw new Error("Recording is too long to normalize for transcription.")
    }
    const output = new Float32Array(outputLength)
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) =>
        audioBuffer.getChannelData(channel)
    )

    for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
        const sourcePosition = (outputIndex * audioBuffer.sampleRate) / targetSampleRate
        const sourceIndex = Math.min(Math.floor(sourcePosition), audioBuffer.length - 1)
        const nextSourceIndex = Math.min(sourceIndex + 1, audioBuffer.length - 1)
        const fraction = sourcePosition - sourceIndex
        let mixedSample = 0

        for (const channel of channels) {
            mixedSample +=
                channel[sourceIndex] + (channel[nextSourceIndex] - channel[sourceIndex]) * fraction
        }
        output[outputIndex] = mixedSample / channels.length
    }

    return output
}

export const prepareAudioForTranscription = async (
    audioBlob: Blob,
    audioContext: Pick<AudioContext, "decodeAudioData">,
    config: TranscriptionConfig
) => {
    const sourceFormat = getTranscriptionAudioFormat(audioBlob.type)
    if (sourceFormat && config.acceptedFormats.includes(sourceFormat)) return audioBlob

    if (config.preferredFormat !== "wav") {
        throw new Error(`Audio normalization to ${config.preferredFormat} is not supported.`)
    }

    const decodedAudio = await audioContext.decodeAudioData(await audioBlob.arrayBuffer())
    const samples = downmixAndResample(decodedAudio, TRANSCRIPTION_SAMPLE_RATE)
    return encodeMonoPcm16Wav(samples, TRANSCRIPTION_SAMPLE_RATE)
}
