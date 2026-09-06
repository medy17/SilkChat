import {
    FAL_R2_INGEST_SIGNATURE_HEADER,
    FAL_R2_INGEST_TIMESTAMP_HEADER,
    signFalR2IngestBody,
    verifyFalR2IngestBody
} from "../../../convex/lib/fal_r2_ingest"
import {
    parseSpeechTicket,
    readSpeechRequest,
    type SpeechTicket
} from "../../../convex/lib/speech_ticket"
import type { MESSAGE_SPEECH } from "../../../convex/lib/speech_config"
import type { getOpenRouterAttribution } from "../../../convex/lib/openrouter_attribution"
import { splitSpeechText } from "../../../src/lib/speech-text-chunks"
import { stripSpeechWavHeader } from "../../../src/lib/speech-pcm"
import type { FalR2WorkerEnv } from "./index"
import { SpeechAssetWriter } from "./speech-asset"
import type { ExecutionContext } from "@cloudflare/workers-types"

const corsHeaders = (origin: string) => ({
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Cache-Control": "no-store"
})
const errorResponse = (error: string, status: number, origin = "*") =>
    Response.json({ error }, { status, headers: corsHeaders(origin) })

async function callback(
    ticket: SpeechTicket,
    phase: "start" | "complete" | "failed",
    secret: string,
    options: {
        cached?: boolean
        submittedCharacters?: number
        submittedUtf8Bytes?: number
    } = {}
) {
    const body = JSON.stringify({
        ticket,
        phase,
        cached: options.cached === true,
        submittedCharacters: options.submittedCharacters ?? 0,
        submittedUtf8Bytes: options.submittedUtf8Bytes ?? 0
    })
    const signed = await signFalR2IngestBody(body, secret)
    const response = await fetch(ticket.callbackUrl, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: {
            "Content-Type": "application/json",
            [FAL_R2_INGEST_SIGNATURE_HEADER]: signed.signature,
            [FAL_R2_INGEST_TIMESTAMP_HEADER]: signed.timestamp
        },
        body
    })
    if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel()
        throw new Error("Speech callback returned a redirect")
    }
    return response
}

export async function handleSpeechRequest(
    request: Request,
    env: FalR2WorkerEnv,
    ctx: Pick<ExecutionContext, "waitUntil">
) {
    if (request.method === "OPTIONS")
        return new Response(null, {
            status: 204,
            headers: {
                ...corsHeaders("*"),
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        })
    if (request.method !== "POST") return errorResponse("Not found", 404)
    if (!env.FAL_R2_INGEST_SECRET) return errorResponse("Read aloud is not configured", 503)
    // Tickets contain only bounded identifiers, never text, audio or provider keys.
    let raw: string
    try {
        raw = await readSpeechRequest(request)
    } catch {
        return errorResponse("Invalid ticket", 400)
    }
    let ticket: SpeechTicket
    try {
        const signed = JSON.parse(raw)
        if (
            typeof signed.body !== "string" ||
            typeof signed.timestamp !== "string" ||
            typeof signed.signature !== "string"
        )
            throw new Error()
        if (
            !(await verifyFalR2IngestBody({
                body: signed.body,
                timestamp: signed.timestamp,
                signature: signed.signature,
                secret: env.FAL_R2_INGEST_SECRET
            }))
        )
            throw new Error()
        const parsed = parseSpeechTicket(JSON.parse(signed.body))
        if (!parsed || parsed.origin !== request.headers.get("Origin")) throw new Error()
        ticket = parsed
    } catch {
        return errorResponse("Invalid playback ticket", 401)
    }
    let started: Response
    let cached: { body: ReadableStream<Uint8Array> } | null = null
    try {
        // Check R2 itself before reserving credits, including when its Convex
        // metadata has not caught up. Cache playback never needs a balance.
        cached = await env.DESTINATION_BUCKET.get(ticket.storageKey)
        started = await callback(ticket, "start", env.FAL_R2_INGEST_SECRET, {
            cached: !!cached
        })
    } catch (error) {
        console.error("[speech] Could not start worker callback", error)
        await cached?.body.cancel().catch(() => {})
        ctx.waitUntil(
            callback(ticket, "failed", env.FAL_R2_INGEST_SECRET)
                .then((response) => response.body?.cancel())
                .catch(() => {})
        )
        return errorResponse("Read aloud is unavailable. Please try again.", 502, ticket.origin)
    }
    if (!started.ok) {
        await cached?.body.cancel()
        const body = (await started.json().catch(() => null)) as { error?: string } | null
        return errorResponse(
            body?.error ?? "This playback request is unavailable. Please try again.",
            started.status,
            ticket.origin
        )
    }
    const { text, apiKey, config, attribution } = (await started.json()) as {
        text: string
        apiKey: string
        config: typeof MESSAGE_SPEECH
        attribution: ReturnType<typeof getOpenRouterAttribution>
    }
    const headers = {
        ...corsHeaders(ticket.origin),
        "Content-Type": `audio/pcm;rate=${config.sampleRate};channels=1`
    }
    const abort = new AbortController()
    const onAbort = () => abort.abort()
    request.signal.addEventListener("abort", onAbort, { once: true })
    if (request.signal.aborted) abort.abort()
    const timer = setTimeout(() => abort.abort(), config.timeoutMs)
    const asset = new SpeechAssetWriter(
        env.DESTINATION_BUCKET,
        ticket.storageKey,
        config.sampleRate
    )
    let saved = false
    let generatedObjectComplete = false
    let submittedCharacters = 0
    let submittedUtf8Bytes = 0
    const submittedUsage = () => ({ submittedCharacters, submittedUtf8Bytes })
    const finish = async () => {
        clearTimeout(timer)
        request.signal.removeEventListener("abort", onAbort)
        if (!saved) {
            if (!generatedObjectComplete) await asset.discard().catch(() => {})
            await callback(ticket, "failed", env.FAL_R2_INGEST_SECRET, submittedUsage())
                .then((response) => response.body?.cancel())
                .catch(() => {})
        }
    }
    async function* generate() {
        try {
            // A completed object may precede its metadata callback after a retry.
            if (cached) {
                const replay = cached.body.pipeThrough(stripSpeechWavHeader()).getReader()
                try {
                    while (true) {
                        const next = await replay.read()
                        if (next.done) break
                        yield next.value
                    }
                } finally {
                    await replay.cancel()
                }
            } else {
                for (const input of splitSpeechText(text, config.chunkCharacters)) {
                    const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
                        method: "POST",
                        signal: abort.signal,
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                            "HTTP-Referer": attribution.appUrl,
                            "X-OpenRouter-Title": attribution.appName,
                            ...attribution.headers
                        },
                        body: JSON.stringify({
                            model: config.model,
                            voice: config.voice,
                            response_format: config.format,
                            input
                        })
                    })
                    if (!response.ok || !response.body)
                        throw new Error(`Speech provider returned ${response.status}`)
                    submittedCharacters += Array.from(input).length
                    submittedUtf8Bytes += new TextEncoder().encode(input).length
                    const mime = response.headers.get("Content-Type") ?? ""
                    const mediaType = mime.split(";", 1)[0]?.trim().toLowerCase()
                    const declaredRate = /(?:^|;)\s*rate=(\d+)/i.exec(mime)?.[1]
                    const declaredChannels = /(?:^|;)\s*channels=(\d+)/i.exec(mime)?.[1]
                    if (
                        mediaType !== "audio/pcm" ||
                        (declaredRate !== undefined &&
                            Number(declaredRate) !== config.sampleRate) ||
                        (declaredChannels !== undefined && declaredChannels !== "1")
                    )
                        throw new Error(`Unexpected speech format: ${mime}`)
                    let segmentBytes = 0
                    const audio = response.body.getReader()
                    try {
                        while (true) {
                            const next = await audio.read()
                            if (next.done) break
                            abort.signal.throwIfAborted()
                            segmentBytes += next.value.length
                            await asset.append(next.value)
                            yield next.value
                        }
                        if (!segmentBytes || segmentBytes % 2)
                            throw new Error("Incomplete speech audio")
                    } finally {
                        await audio.cancel().catch(() => {})
                    }
                }
                abort.signal.throwIfAborted()
                await asset.complete()
                generatedObjectComplete = true
            }
            const completion = await callback(
                ticket,
                "complete",
                env.FAL_R2_INGEST_SECRET,
                submittedUsage()
            )
            if (!completion.ok) {
                if (completion.status === 403) {
                    await env.DESTINATION_BUCKET.delete(ticket.storageKey)
                }
                throw new Error("Could not register speech asset")
            }
            await completion.body?.cancel()
            saved = true
        } finally {
            await finish()
        }
    }
    const iterator = generate()
    let first: IteratorResult<Uint8Array>
    try {
        first = await iterator.next()
    } catch (error) {
        console.error("[speech] Generation failed before playback", error)
        abort.abort()
        return errorResponse(
            "Read aloud is temporarily unavailable. Please try again.",
            502,
            ticket.origin
        )
    }
    return new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                if (!first.done) controller.enqueue(first.value)
            },
            async pull(controller) {
                try {
                    const next = await iterator.next()
                    if (next.done) controller.close()
                    else controller.enqueue(next.value)
                } catch (error) {
                    console.error("[speech] Generation stream failed", error)
                    abort.abort()
                    controller.error(error)
                }
            },
            cancel() {
                abort.abort()
                ctx.waitUntil(iterator.return().then(() => {}))
            }
        }),
        { headers }
    )
}
