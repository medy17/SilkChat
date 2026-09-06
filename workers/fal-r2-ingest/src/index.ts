import {
    FAL_R2_INGEST_SIGNATURE_HEADER,
    FAL_R2_INGEST_TIMESTAMP_HEADER,
    type FalR2IngestTask,
    parseFalR2IngestEnvelope,
    verifyFalR2IngestBody
} from "../../../convex/lib/fal_r2_ingest"
import { handleSpeechRequest } from "./speech"
import type { ExecutionContext } from "@cloudflare/workers-types"

export type FalR2WorkerEnv = Omit<
    Env,
    "ALLOWED_SOURCE_HOSTS" | "MAX_ASSET_BYTES" | "UPSTREAM_TIMEOUT_MS"
> & {
    FAL_R2_INGEST_SECRET: string
    ALLOWED_SOURCE_HOSTS: string
    MAX_ASSET_BYTES: string
    UPSTREAM_TIMEOUT_MS: string
}

class RequestTooLargeError extends Error {}

const MAX_REQUEST_BYTES = 64 * 1024
const DEFAULT_MAX_ASSET_BYTES = 100 * 1024 * 1024
const DEFAULT_UPSTREAM_TIMEOUT_MS = 2 * 60 * 1000
const MAX_REDIRECTS = 3

const jsonResponse = (body: unknown, status: number) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

const getPositiveInteger = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

const readBoundedText = async (request: Request) => {
    const declaredLength = request.headers.get("Content-Length")
    if (declaredLength && Number(declaredLength) > MAX_REQUEST_BYTES) {
        throw new RequestTooLargeError("Request body is too large")
    }
    if (!request.body) return ""

    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > MAX_REQUEST_BYTES) {
            await reader.cancel()
            throw new RequestTooLargeError("Request body is too large")
        }
        chunks.push(value)
    }

    const body = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
    }
    return new TextDecoder().decode(body)
}

const getAllowedSourceHosts = (env: FalR2WorkerEnv) =>
    env.ALLOWED_SOURCE_HOSTS.split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)

const isAllowedSourceUrl = (value: string, env: FalR2WorkerEnv) => {
    const url = new URL(value)
    if (url.protocol !== "https:") return false
    const hostname = url.hostname.toLowerCase()
    return getAllowedSourceHosts(env).some((allowed) =>
        allowed.startsWith(".") ? hostname.endsWith(allowed) : hostname === allowed
    )
}

const fetchAllowedSource = async (
    sourceUrl: string,
    env: FalR2WorkerEnv,
    redirectCount = 0
): Promise<Response> => {
    if (!isAllowedSourceUrl(sourceUrl, env)) {
        throw new Error("Source URL host is not allowed")
    }

    const response = await fetch(sourceUrl, {
        redirect: "manual",
        headers: { Accept: "image/*", "Accept-Encoding": "identity" },
        signal: AbortSignal.timeout(
            getPositiveInteger(env.UPSTREAM_TIMEOUT_MS, DEFAULT_UPSTREAM_TIMEOUT_MS)
        )
    })
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location")
        if (!location || redirectCount >= MAX_REDIRECTS) {
            throw new Error("Upstream returned an invalid redirect")
        }
        return await fetchAllowedSource(
            new URL(location, sourceUrl).toString(),
            env,
            redirectCount + 1
        )
    }
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`)
    return response
}

const normalizeImageContentType = (value?: string) => {
    const normalized = value?.split(";")[0]?.trim().toLowerCase()
    return normalized?.startsWith("image/") ? normalized : undefined
}

export const storeFalAsset = async (task: FalR2IngestTask, env: FalR2WorkerEnv) => {
    const existing = await env.DESTINATION_BUCKET.head(task.storageKey)
    if (existing) return existing

    const response = await fetchAllowedSource(task.sourceUrl, env)
    if (!response.body) throw new Error("Upstream returned an empty body")

    const maxBytes = getPositiveInteger(env.MAX_ASSET_BYTES, DEFAULT_MAX_ASSET_BYTES)
    const contentLength = response.headers.get("Content-Length")
    const declaredSize = contentLength ? Number(contentLength) : Number.NaN
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
        throw new Error("Upstream did not declare a valid asset size")
    }
    if (declaredSize > maxBytes) {
        throw new Error("Asset exceeds the upload limit")
    }

    const contentType =
        normalizeImageContentType(response.headers.get("Content-Type") ?? undefined) ??
        normalizeImageContentType(task.contentType)
    if (!contentType) {
        throw new Error("Upstream did not return a supported image type")
    }

    const stored = await env.DESTINATION_BUCKET.put(task.storageKey, response.body, {
        httpMetadata: { contentType },
        onlyIf: { etagDoesNotMatch: "*" }
    })
    if (stored) return stored

    const racedObject = await env.DESTINATION_BUCKET.head(task.storageKey)
    if (!racedObject) throw new Error("R2 rejected the conditional write")
    return racedObject
}

export const handleIngestRequest = async (request: Request, env: FalR2WorkerEnv) => {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/ingest") {
        return jsonResponse({ error: "Not found" }, 404)
    }
    if (!env.FAL_R2_INGEST_SECRET) {
        return jsonResponse({ error: "Worker secret is not configured" }, 503)
    }

    let rawBody: string
    try {
        rawBody = await readBoundedText(request)
    } catch (error) {
        if (error instanceof RequestTooLargeError) {
            return jsonResponse({ error: error.message }, 413)
        }
        throw error
    }

    const verified = await verifyFalR2IngestBody({
        body: rawBody,
        secret: env.FAL_R2_INGEST_SECRET,
        timestamp: request.headers.get(FAL_R2_INGEST_TIMESTAMP_HEADER),
        signature: request.headers.get(FAL_R2_INGEST_SIGNATURE_HEADER)
    })
    if (!verified) return jsonResponse({ error: "Invalid signature" }, 401)

    let payload: unknown
    try {
        payload = JSON.parse(rawBody)
    } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400)
    }
    const envelope = parseFalR2IngestEnvelope(payload)
    if (!envelope) return jsonResponse({ error: "Invalid ingest request" }, 400)

    try {
        for (const task of envelope.tasks) {
            await storeFalAsset(task, env)
        }
        return new Response(null, { status: 204 })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Asset ingestion failed"
        console.error(JSON.stringify({ message: "fal asset ingestion failed", error: message }))
        return jsonResponse({ error: message }, 502)
    }
}

export default {
    fetch(request: Request, env: FalR2WorkerEnv, ctx: ExecutionContext) {
        return new URL(request.url).pathname === "/speech"
            ? handleSpeechRequest(request, env, ctx)
            : handleIngestRequest(request, env)
    }
}
