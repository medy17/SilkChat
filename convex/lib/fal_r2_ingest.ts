export const FAL_R2_INGEST_SIGNATURE_HEADER = "X-SilkChat-Ingest-Signature"
export const FAL_R2_INGEST_TIMESTAMP_HEADER = "X-SilkChat-Ingest-Timestamp"
export const FAL_R2_INGEST_VERSION = 1 as const

const SIGNATURE_LEEWAY_SECONDS = 5 * 60
const encoder = new TextEncoder()

export type FalR2IngestTask = {
    sourceUrl: string
    storageKey: string
    contentType?: string
}

export type FalR2IngestEnvelope = {
    version: typeof FAL_R2_INGEST_VERSION
    tasks: FalR2IngestTask[]
}

const asObject = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null

const getString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : undefined

const parseHttpsUrl = (value: unknown) => {
    const raw = getString(value)
    if (!raw) return undefined
    try {
        const url = new URL(raw)
        return url.protocol === "https:" ? url.toString() : undefined
    } catch {
        return undefined
    }
}

const parseTask = (value: unknown): FalR2IngestTask | null => {
    const task = asObject(value)
    if (!task) return null

    const sourceUrl = parseHttpsUrl(task.sourceUrl)
    const storageKey = getString(task.storageKey)
    const contentType = getString(task.contentType)
    if (!sourceUrl || !storageKey?.startsWith("generations/")) return null

    return { sourceUrl, storageKey, ...(contentType ? { contentType } : {}) }
}

export const parseFalR2IngestEnvelope = (value: unknown): FalR2IngestEnvelope | null => {
    const envelope = asObject(value)
    if (
        !envelope ||
        envelope.version !== FAL_R2_INGEST_VERSION ||
        !Array.isArray(envelope.tasks) ||
        envelope.tasks.length === 0 ||
        envelope.tasks.length > 16
    ) {
        return null
    }

    const tasks = envelope.tasks.map(parseTask)
    if (tasks.some((task) => task === null)) return null
    return { version: FAL_R2_INGEST_VERSION, tasks: tasks as FalR2IngestTask[] }
}

const bytesToHex = (bytes: ArrayBuffer) =>
    Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")

const hexToBytes = (value: string) => {
    if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null
    const bytes = new Uint8Array(value.length / 2)
    for (let index = 0; index < value.length; index += 2) {
        bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
    }
    return bytes
}

const sign = async (body: string, secret: string, timestamp: string) => {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    return await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}\n${body}`))
}

export const signFalR2IngestBody = async (body: string, secret: string) => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    return { timestamp, signature: bytesToHex(await sign(body, secret, timestamp)) }
}

export const verifyFalR2IngestBody = async ({
    body,
    secret,
    timestamp,
    signature,
    nowSeconds = Math.floor(Date.now() / 1000)
}: {
    body: string
    secret: string
    timestamp: string | null
    signature: string | null
    nowSeconds?: number
}) => {
    if (!secret || !timestamp || !signature) return false
    const timestampSeconds = Number.parseInt(timestamp, 10)
    if (
        !Number.isFinite(timestampSeconds) ||
        Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_LEEWAY_SECONDS
    ) {
        return false
    }

    const provided = hexToBytes(signature)
    if (!provided) return false
    const expected = new Uint8Array(await sign(body, secret, timestamp))
    if (provided.length !== expected.length) return false

    let difference = 0
    for (let index = 0; index < expected.length; index += 1) {
        difference |= provided[index] ^ expected[index]
    }
    return difference === 0
}
