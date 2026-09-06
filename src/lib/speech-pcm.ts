// PCM chunks may end halfway through a signed 16-bit little-endian sample.
export class SpeechPcmDecoder {
    private pending = new Uint8Array(0)

    push(bytes: Uint8Array, flush = false): Float32Array | null {
        const combined = new Uint8Array(this.pending.length + bytes.length)
        combined.set(this.pending)
        combined.set(bytes, this.pending.length)
        if (flush && combined.length % 2) throw new Error("Incomplete speech audio")
        const count = flush ? combined.length : Math.floor(combined.length / 4800) * 4800
        this.pending = combined.slice(count)
        if (!count) return null
        const samples = new Float32Array(count / 2)
        const view = new DataView(combined.buffer)
        for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768
        return samples
    }
}

export function speechWavHeader(audioBytes: number, sampleRate: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(44)
    const view = new DataView(bytes.buffer)
    const write = (offset: number, value: string) =>
        bytes.set(new TextEncoder().encode(value), offset)
    write(0, "RIFF")
    view.setUint32(4, 36 + audioBytes, true)
    write(8, "WAVEfmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    write(36, "data")
    view.setUint32(40, audioBytes, true)
    return bytes
}

// Our saved WAVs have a fixed 44-byte header. Strip it while replaying PCM.
export function stripSpeechWavHeader() {
    let remaining = 44
    return new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
            const skip = Math.min(remaining, chunk.length)
            remaining -= skip
            if (chunk.length > skip) controller.enqueue(chunk.subarray(skip))
        },
        flush() {
            if (remaining) throw new Error("Incomplete saved audio")
        }
    })
}
