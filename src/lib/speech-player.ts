import { create } from "zustand"
import { MESSAGE_SPEECH } from "../../convex/lib/speech_config"
import { resolveJwtToken } from "./auth-token"
import { browserEnv } from "./browser-env"
import { SpeechPcmDecoder, stripSpeechWavHeader } from "./speech-pcm"

type SpeechState = {
    messageId: string | null
    text: string | null
    status: "idle" | "loading" | "playing" | "paused" | "error"
    error: string | null
}
const initial: SpeechState = { messageId: null, text: null, status: "idle", error: null }
export const useSpeechPlayer = create<SpeechState>(() => initial)

type Playback = {
    context: AudioContext
    abort: AbortController
    sources: Set<AudioBufferSourceNode>
    nextTime: number
    complete: boolean
}
let active: Playback | null = null

export function stopSpeech() {
    const previous = active
    active = null
    previous?.abort.abort()
    if (previous) {
        for (const source of previous.sources) {
            source.onended = null
            source.stop()
            source.disconnect()
        }
        void previous.context.close().catch(() => {})
    }
    useSpeechPlayer.setState(initial)
}

function finishPlayback(playback: Playback) {
    if (active === playback && playback.complete && playback.sources.size === 0) stopSpeech()
}

function scheduleSamples(playback: Playback, samples: Float32Array | null) {
    if (!samples || active !== playback) return
    const buffer = playback.context.createBuffer(1, samples.length, MESSAGE_SPEECH.sampleRate)
    buffer.getChannelData(0).set(samples)
    const source = playback.context.createBufferSource()
    source.buffer = buffer
    source.connect(playback.context.destination)
    playback.sources.add(source)
    source.onended = () => {
        playback.sources.delete(source)
        source.disconnect()
        finishPlayback(playback)
    }
    const start = Math.max(playback.nextTime, playback.context.currentTime + 0.04)
    source.start(start)
    playback.nextTime = start + buffer.duration
    if (useSpeechPlayer.getState().status !== "paused")
        useSpeechPlayer.setState({ status: "playing" })
}

export async function toggleSpeechPause() {
    const playback = active
    if (!playback) return
    try {
        if (useSpeechPlayer.getState().status === "paused") {
            await playback.context.resume()
            if (active === playback)
                useSpeechPlayer.setState({ status: playback.sources.size ? "playing" : "loading" })
        } else {
            await playback.context.suspend()
            if (active === playback) useSpeechPlayer.setState({ status: "paused" })
        }
    } catch {
        if (active === playback) stopSpeech()
    }
}

export async function startSpeech(messageId: string, threadId: string, text: string) {
    stopSpeech()
    useSpeechPlayer.setState({ messageId, text, status: "loading", error: null })
    let playback: Playback | undefined
    try {
        // Create and resume during the click gesture, before requesting credentials.
        const context = new AudioContext()
        playback = {
            context,
            abort: new AbortController(),
            sources: new Set(),
            nextTime: 0,
            complete: false
        }
        active = playback
        await context.resume()
        const jwt = await resolveJwtToken(null)
        if (active !== playback) return
        if (!jwt) throw new Error("Please sign in to read messages aloud")
        const prepared = await fetch(`${browserEnv("VITE_CONVEX_API_URL")}/speech`, {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, threadId }),
            signal: playback.abort.signal
        })
        if (!prepared.ok) {
            const body = await prepared.json().catch(() => null)
            throw new Error(body?.error ?? "Read aloud is unavailable. Please try again.")
        }
        const target = (await prepared.json()) as {
            url: string
            format: "pcm" | "wav"
            ticket?: unknown
        }
        if (active !== playback) return
        // Only the small playback ticket crosses Convex. Audio travels directly from the worker/R2.
        const response = await fetch(target.url, {
            method: target.ticket ? "POST" : "GET",
            ...(target.ticket
                ? { body: JSON.stringify(target.ticket), headers: { "Content-Type": "text/plain" } }
                : {}),
            signal: playback.abort.signal
        })
        if (!response.ok || !response.body) {
            const body = await response.json().catch(() => null)
            throw new Error(body?.error ?? "Read aloud is unavailable. Please try again.")
        }
        const reader = (
            target.format === "wav"
                ? response.body.pipeThrough(stripSpeechWavHeader())
                : response.body
        ).getReader()
        const decoder = new SpeechPcmDecoder()
        let bytes = 0
        try {
            while (true) {
                // Bound queued playback independently of recording length, including while paused.
                while (active === playback && playback.nextTime - context.currentTime > 30) {
                    await new Promise((resolve) => setTimeout(resolve, 100))
                }
                if (active !== playback) return
                const { value, done } = await reader.read()
                if (active !== playback) return
                if (done) break
                bytes += value.byteLength
                scheduleSamples(playback, decoder.push(value))
            }
            if (!bytes) throw new Error("No speech audio was received")
            scheduleSamples(playback, decoder.push(new Uint8Array(0), true))
            playback.complete = true
            finishPlayback(playback)
        } finally {
            await reader.cancel().catch(() => {})
        }
    } catch (error) {
        if (playback && active !== playback) return
        stopSpeech()
        useSpeechPlayer.setState({
            messageId,
            text,
            status: "error",
            error: error instanceof Error ? error.message : "Read aloud failed. Please try again."
        })
    }
}
