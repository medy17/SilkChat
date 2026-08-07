import { afterEach, describe, expect, it, vi } from "vitest"
import { createFalR2IngestTasks, ingestFalImagesViaWorker } from "../../convex/fal_webhooks"
import {
    FAL_R2_INGEST_SIGNATURE_HEADER,
    FAL_R2_INGEST_TIMESTAMP_HEADER,
    FAL_R2_INGEST_VERSION,
    type FalR2IngestEnvelope,
    parseFalR2IngestEnvelope,
    signFalR2IngestBody,
    verifyFalR2IngestBody
} from "../../convex/lib/fal_r2_ingest"
import {
    type FalR2WorkerEnv,
    handleIngestRequest,
    storeFalAsset
} from "../../workers/fal-r2-ingest/src/index"

const task = {
    sourceUrl: "https://v3b.fal.media/files/b/image.png",
    storageKey: "generations/user-1/job-1-1-fal.png",
    contentType: "image/png"
}
const envelope: FalR2IngestEnvelope = {
    version: FAL_R2_INGEST_VERSION,
    tasks: [task]
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("fal R2 ingestion", () => {
    it("authenticates exact request bodies and rejects stale or changed payloads", async () => {
        const body = JSON.stringify(envelope)
        const signed = await signFalR2IngestBody(body, "shared-secret")

        await expect(
            verifyFalR2IngestBody({
                body,
                secret: "shared-secret",
                timestamp: signed.timestamp,
                signature: signed.signature
            })
        ).resolves.toBe(true)
        await expect(
            verifyFalR2IngestBody({
                body: `${body} `,
                secret: "shared-secret",
                timestamp: signed.timestamp,
                signature: signed.signature
            })
        ).resolves.toBe(false)
        await expect(
            verifyFalR2IngestBody({
                body,
                secret: "shared-secret",
                timestamp: signed.timestamp,
                signature: signed.signature,
                nowSeconds: Number(signed.timestamp) + 301
            })
        ).resolves.toBe(false)
    })

    it("accepts only HTTPS sources and generation keys", () => {
        expect(parseFalR2IngestEnvelope(envelope)).toEqual(envelope)
        expect(
            parseFalR2IngestEnvelope({
                ...envelope,
                tasks: [{ ...task, sourceUrl: "http://v3b.fal.media/image.png" }]
            })
        ).toBeNull()
        expect(
            parseFalR2IngestEnvelope({
                ...envelope,
                tasks: [{ ...task, storageKey: "attachments/user-1/file.png" }]
            })
        ).toBeNull()
    })

    it("creates deterministic object keys for webhook retries", () => {
        const args = {
            jobId: "job-1",
            userId: "user-1",
            images: [{ url: task.sourceUrl, contentType: "image/jpeg" }]
        }

        expect(createFalR2IngestTasks(args)).toEqual(createFalR2IngestTasks(args))
        expect(createFalR2IngestTasks(args)[0]).toMatchObject({
            storageKey: "generations/user-1/job-1-1-fal.jpg"
        })
    })

    it("sends one signed request to the Worker", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
        vi.stubGlobal("fetch", fetchMock)

        await expect(
            ingestFalImagesViaWorker([task], {
                endpoint: "https://ingest.example.com/ingest",
                secret: "shared-secret"
            })
        ).resolves.toBeUndefined()

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        const headers = new Headers(init.headers)
        expect(url).toBe("https://ingest.example.com/ingest")
        await expect(
            verifyFalR2IngestBody({
                body: String(init.body),
                secret: "shared-secret",
                timestamp: headers.get(FAL_R2_INGEST_TIMESTAMP_HEADER),
                signature: headers.get(FAL_R2_INGEST_SIGNATURE_HEADER)
            })
        ).resolves.toBe(true)
    })

    it("streams a chunked fal response into R2", async () => {
        const upstreamResponse = new Response(new Uint8Array([1, 2, 3]), {
            headers: { "Content-Type": "image/png" }
        })
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamResponse))
        const put = vi.fn(async (_key: string, body: ReadableStream<Uint8Array>) => {
            expect(new Uint8Array(await new Response(body).arrayBuffer())).toEqual(
                new Uint8Array([1, 2, 3])
            )
            return { size: 3, httpMetadata: { contentType: "image/png" } }
        })
        const body = JSON.stringify(envelope)
        const signed = await signFalR2IngestBody(body, "shared-secret")
        const request = new Request("https://ingest.example.com/ingest", {
            method: "POST",
            headers: {
                [FAL_R2_INGEST_SIGNATURE_HEADER]: signed.signature,
                [FAL_R2_INGEST_TIMESTAMP_HEADER]: signed.timestamp
            },
            body
        })
        const env = {
            FAL_R2_INGEST_SECRET: "shared-secret",
            ALLOWED_SOURCE_HOSTS: ".fal.media",
            MAX_ASSET_BYTES: "104857600",
            UPSTREAM_TIMEOUT_MS: "120000",
            DESTINATION_BUCKET: { head: vi.fn(async () => null), put }
        } as FalR2WorkerEnv

        const response = await handleIngestRequest(request, env)

        expect(response.status).toBe(204)
        expect(put).toHaveBeenCalledOnce()
    })

    it("enforces the asset limit while streaming when Content-Length is absent", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(new Uint8Array([1, 2, 3]), {
                    headers: { "Content-Type": "image/png" }
                })
            )
        )
        const env = {
            FAL_R2_INGEST_SECRET: "shared-secret",
            ALLOWED_SOURCE_HOSTS: ".fal.media",
            MAX_ASSET_BYTES: "2",
            UPSTREAM_TIMEOUT_MS: "120000",
            DESTINATION_BUCKET: {
                head: vi.fn(async () => null),
                put: vi.fn(async (_key: string, body: ReadableStream<Uint8Array>) => {
                    await new Response(body).arrayBuffer()
                    return null
                })
            }
        } as FalR2WorkerEnv

        await expect(storeFalAsset(task, env)).rejects.toThrow("Asset exceeds the upload limit")
    })
})
