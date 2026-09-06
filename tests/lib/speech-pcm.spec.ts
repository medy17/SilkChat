import { describe, expect, it } from "vitest"
import { SpeechPcmDecoder, speechWavHeader, stripSpeechWavHeader } from "../../src/lib/speech-pcm"

describe("streamed speech PCM", () => {
    it("preserves samples across odd chunk boundaries", () => {
        const decoder = new SpeechPcmDecoder()
        expect(decoder.push(new Uint8Array([0, 128, 255]))).toBeNull()
        const samples = decoder.push(new Uint8Array([127, 0, 0]), true)
        expect(Array.from(samples ?? [])).toEqual([-1, 32767 / 32768, 0])
    })

    it("emits playable samples before the stream finishes", () => {
        const decoder = new SpeechPcmDecoder()
        expect(decoder.push(new Uint8Array(4801))?.length).toBe(2400)
        expect(decoder.push(new Uint8Array([0]), true)?.length).toBe(1)
    })

    it("rejects incomplete samples", () => {
        expect(() => new SpeechPcmDecoder().push(new Uint8Array([1]), true)).toThrow("Incomplete")
    })

    it("saves a valid WAV header and strips it across fragmented replay chunks", async () => {
        const header = speechWavHeader(4, 24000)
        expect(new TextDecoder().decode(header.slice(0, 4))).toBe("RIFF")
        expect(new DataView(header.buffer).getUint32(40, true)).toBe(4)
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(header.slice(0, 20))
                controller.enqueue(new Uint8Array([...header.slice(20), 1, 2, 3, 4]))
                controller.close()
            }
        })
        expect(
            Array.from(
                new Uint8Array(
                    await new Response(body.pipeThrough(stripSpeechWavHeader())).arrayBuffer()
                )
            )
        ).toEqual([1, 2, 3, 4])
    })
})
