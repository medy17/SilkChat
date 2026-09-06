import { speechWavHeader } from "../../../src/lib/speech-pcm"
import type { FalR2WorkerEnv } from "./index"

type SpeechBucket = FalR2WorkerEnv["DESTINATION_BUCKET"]

const PART_BYTES = 5 * 1024 * 1024

// Hold the first part for the WAV length header and upload later parts as they arrive.
// Memory stays bounded to two multipart chunks regardless of recording length.
export class SpeechAssetWriter {
    private first = new Uint8Array(PART_BYTES - 44)
    private firstLength = 0
    private pending = new Uint8Array(PART_BYTES)
    private pendingLength = 0
    private total = 0
    private upload: Awaited<ReturnType<SpeechBucket["createMultipartUpload"]>> | null = null
    private parts: { partNumber: number; etag: string }[] = []
    private committed = false

    constructor(
        private bucket: SpeechBucket,
        private key: string,
        private sampleRate: number
    ) {}

    async append(bytes: Uint8Array) {
        this.total += bytes.length
        // WAV's RIFF length is a 32-bit unsigned field.
        if (this.total > 0xffffffff - 36) throw new Error("Recording exceeds WAV format limits")
        let offset = 0
        if (this.firstLength < this.first.length) {
            const size = Math.min(bytes.length, this.first.length - this.firstLength)
            this.first.set(bytes.subarray(0, size), this.firstLength)
            this.firstLength += size
            offset += size
        }
        while (offset < bytes.length) {
            if (!this.upload)
                this.upload = await this.bucket.createMultipartUpload(this.key, {
                    httpMetadata: { contentType: "audio/wav" }
                })
            const size = Math.min(bytes.length - offset, this.pending.length - this.pendingLength)
            this.pending.set(bytes.subarray(offset, offset + size), this.pendingLength)
            this.pendingLength += size
            offset += size
            if (this.pendingLength === this.pending.length) {
                this.parts.push(await this.upload.uploadPart(this.parts.length + 2, this.pending))
                this.pendingLength = 0
            }
        }
    }

    async complete() {
        if (!this.total || this.total % 2) throw new Error("Incomplete speech audio")
        const first = new Uint8Array(44 + this.firstLength)
        first.set(speechWavHeader(this.total, this.sampleRate))
        first.set(this.first.subarray(0, this.firstLength), 44)
        if (this.upload) {
            if (this.pendingLength)
                this.parts.push(
                    await this.upload.uploadPart(
                        this.parts.length + 2,
                        this.pending.subarray(0, this.pendingLength)
                    )
                )
            const head = await this.upload.uploadPart(1, first)
            await this.upload.complete([head, ...this.parts])
        } else
            await this.bucket.put(this.key, first, { httpMetadata: { contentType: "audio/wav" } })
        this.committed = true
    }

    async discard() {
        if (this.committed) await this.bucket.delete(this.key)
        else if (this.upload) await this.upload.abort()
    }
}
