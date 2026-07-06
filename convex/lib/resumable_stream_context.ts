import { Redis } from "@upstash/redis"

type ResumableStreamState = "ACTIVE" | "DONE" | "STOPPED"

interface CreateResumableStreamOptions {
    skipCharacters?: number
    onStop?: () => void
}

interface ResumableStreamContext {
    createNewResumableStream: (
        streamId: string,
        makeStream: () => ReadableStream<string>,
        options?: CreateResumableStreamOptions
    ) => Promise<ReadableStream<string> | null>
    resumeExistingStream: (
        streamId: string,
        skipCharacters?: number
    ) => Promise<ReadableStream<string> | null | undefined>
    requestStreamStop: (streamId: string) => Promise<void>
}

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.log(" > Resumable streams are disabled due to missing UPSTASH_REDIS_REST_URL")
}
if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log(" > Resumable streams are disabled due to missing UPSTASH_REDIS_REST_TOKEN")
}

const STREAM_TTL_SECONDS = 24 * 60 * 60
const POLL_INTERVAL_MS = 150
const STOP_CHECK_INTERVAL_MS = 1_000
// A writer that died without marking DONE leaves the state stuck at ACTIVE for
// the full TTL; replays bail out once the chunk list has been quiet this long.
const MAX_REPLAY_IDLE_MS = 5 * 60_000
const keyPrefix = "resumable-stream:rs"

const stateKey = (streamId: string) => `${keyPrefix}:state:${streamId}`
const chunksKey = (streamId: string) => `${keyPrefix}:chunks:${streamId}`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getStreamState = async (streamId: string) =>
    (await redis.get(stateKey(streamId))) as ResumableStreamState | null

const setStreamState = async (streamId: string, state: ResumableStreamState) => {
    await redis.set(stateKey(streamId), state, { ex: STREAM_TTL_SECONDS })
}

const normalizeChunk = (chunk: unknown) => (typeof chunk === "string" ? chunk : String(chunk ?? ""))

const persistStream = async (
    streamId: string,
    makeStream: () => ReadableStream<string>,
    onStop?: () => void
) => {
    const reader = makeStream().getReader()
    let pendingChunks: string[] = []
    let chunksKeyHasTtl = false
    let flushChain: Promise<void> = Promise.resolve()
    let finished = false

    const flushPendingChunks = async () => {
        if (pendingChunks.length === 0) return
        const batch = pendingChunks
        pendingChunks = []
        await redis.rpush(chunksKey(streamId), ...batch)
        if (!chunksKeyHasTtl) {
            chunksKeyHasTtl = true
            await redis.expire(chunksKey(streamId), STREAM_TTL_SECONDS)
        }
    }

    const scheduleFlush = () => {
        flushChain = flushChain.then(flushPendingChunks).catch((error) => {
            console.error("[Redis] Failed to persist resumable stream chunks", {
                streamId,
                error
            })
        })
        return flushChain
    }

    if (onStop) {
        void (async () => {
            while (!finished) {
                await sleep(STOP_CHECK_INTERVAL_MS)
                if (finished) return
                try {
                    if ((await getStreamState(streamId)) === "STOPPED") {
                        onStop()
                        return
                    }
                } catch (error) {
                    console.warn("[Redis] Failed to check resumable stream stop state", {
                        streamId,
                        error
                    })
                }
            }
        })()
    }

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            pendingChunks.push(value)
            void scheduleFlush()
        }
    } catch (error) {
        console.error("[Redis] Failed to read resumable stream source", { streamId, error })
    } finally {
        finished = true
        await scheduleFlush()
        await setStreamState(streamId, "DONE")
        reader.releaseLock()
    }
}

const createReplayStream = (streamId: string, skipCharacters = 0): ReadableStream<string> => {
    let canceled = false

    return new ReadableStream<string>({
        async start(controller) {
            let cursor = 0
            let skippedCharacters = 0
            let lastProgressAt = Date.now()

            const enqueueWithSkip = (chunk: string) => {
                if (skippedCharacters >= skipCharacters) {
                    controller.enqueue(chunk)
                    return
                }

                const remainingSkip = skipCharacters - skippedCharacters
                if (remainingSkip >= chunk.length) {
                    skippedCharacters += chunk.length
                    return
                }

                skippedCharacters = skipCharacters
                controller.enqueue(chunk.slice(remainingSkip))
            }

            while (!canceled) {
                // State must be read before the chunks: the writer flushes its
                // final chunks before marking the state terminal, so a chunk
                // read issued after observing DONE cannot miss the tail (the
                // finish part / SSE terminator). Reading both in parallel let
                // a DONE state pair with a stale chunk list and truncate the
                // replay, leaving resumed clients stuck in "streaming".
                const state = await getStreamState(streamId)
                const chunks = await redis.lrange(chunksKey(streamId), cursor, -1)
                const normalizedChunks = Array.isArray(chunks) ? chunks.map(normalizeChunk) : []

                for (const chunk of normalizedChunks) {
                    enqueueWithSkip(chunk)
                }
                cursor += normalizedChunks.length

                if (state !== "ACTIVE") {
                    controller.close()
                    return
                }

                if (normalizedChunks.length > 0) {
                    lastProgressAt = Date.now()
                } else if (Date.now() - lastProgressAt >= MAX_REPLAY_IDLE_MS) {
                    controller.close()
                    return
                }

                await sleep(POLL_INTERVAL_MS)
            }
        },
        cancel() {
            canceled = true
        }
    })
}

let globalStreamContext: ResumableStreamContext | null = null

export const getResumableStreamContext = () => {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null
    }

    if (!globalStreamContext) {
        globalStreamContext = {
            createNewResumableStream: async (streamId, makeStream, options) => {
                await redis.del(chunksKey(streamId))
                await setStreamState(streamId, "ACTIVE")

                void persistStream(streamId, makeStream, options?.onStop)

                return createReplayStream(streamId, options?.skipCharacters)
            },
            resumeExistingStream: async (streamId, skipCharacters) => {
                const state = await getStreamState(streamId)

                if (!state) {
                    return undefined
                }

                if (state !== "ACTIVE") {
                    return null
                }

                return createReplayStream(streamId, skipCharacters)
            },
            requestStreamStop: async (streamId) => {
                // xx: only flag streams that still have a state entry; the
                // writer notices on its next stop check and aborts generation.
                await redis.set(stateKey(streamId), "STOPPED", {
                    xx: true,
                    ex: STREAM_TTL_SECONDS
                })
            }
        }
    }

    return globalStreamContext
}
