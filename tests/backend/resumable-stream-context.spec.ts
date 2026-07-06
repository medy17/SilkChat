import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
    const values = new Map<string, string>()
    const lists = new Map<string, string[]>()

    const redis = {
        del: vi.fn(async (key: string) => {
            values.delete(key)
            lists.delete(key)
            return 1
        }),
        expire: vi.fn(async () => 1),
        get: vi.fn(async (key: string) => values.get(key) ?? null),
        lrange: vi.fn(async (key: string, start: number, stop: number) => {
            const list = lists.get(key) ?? []
            const normalizedStop = stop < 0 ? list.length + stop : stop
            return list.slice(start, normalizedStop + 1)
        }),
        rpush: vi.fn(async (key: string, ...pushed: string[]) => {
            const list = lists.get(key) ?? []
            list.push(...pushed)
            lists.set(key, list)
            return list.length
        }),
        set: vi.fn(async (key: string, value: string, options?: { xx?: boolean }) => {
            if (options?.xx && !values.has(key)) {
                return null
            }
            values.set(key, value)
            return "OK"
        })
    }

    return {
        lists,
        redis,
        values
    }
})

vi.mock("@upstash/redis", () => ({
    Redis: vi.fn(function Redis() {
        return mocks.redis
    })
}))

const waitFor = async (condition: () => boolean, timeoutMs = 1_000) => {
    const startedAt = Date.now()
    while (!condition()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error("Timed out waiting for condition")
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
}

describe("resumable stream Redis buffer", () => {
    beforeEach(() => {
        vi.resetModules()
        mocks.lists.clear()
        mocks.values.clear()
        Object.values(mocks.redis).forEach((method) => method.mockClear())
        process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com"
        process.env.UPSTASH_REDIS_REST_TOKEN = "token"
    })

    it("replays chunks appended after a client has already resumed", async () => {
        const { getResumableStreamContext } = await import(
            "../../convex/lib/resumable_stream_context"
        )
        const streamContext = getResumableStreamContext()
        let sourceController: ReadableStreamDefaultController<string> | undefined
        const source = new ReadableStream<string>({
            start(controller) {
                sourceController = controller
            }
        })

        await streamContext?.createNewResumableStream("stream-1", () => source)
        const resumedStream = await streamContext?.resumeExistingStream("stream-1")
        const reader = resumedStream?.getReader()

        sourceController?.enqueue("hello")

        await waitFor(() => mocks.redis.rpush.mock.calls.length > 0)
        await expect(reader?.read()).resolves.toEqual({
            done: false,
            value: "hello"
        })

        sourceController?.close()
        await waitFor(() => mocks.values.get("resumable-stream:rs:state:stream-1") === "DONE")
        await expect(reader?.read()).resolves.toEqual({
            done: true,
            value: undefined
        })
    })

    it("returns null for streams that are already marked done", async () => {
        const { getResumableStreamContext } = await import(
            "../../convex/lib/resumable_stream_context"
        )
        const streamContext = getResumableStreamContext()
        const source = new ReadableStream<string>({
            start(controller) {
                controller.enqueue("done")
                controller.close()
            }
        })

        await streamContext?.createNewResumableStream("stream-1", () => source)
        await waitFor(() => mocks.values.get("resumable-stream:rs:state:stream-1") === "DONE")

        await expect(streamContext?.resumeExistingStream("stream-1")).resolves.toBeNull()
    })

    it("notifies the writer and closes replays when a stop is requested", async () => {
        const { getResumableStreamContext } = await import(
            "../../convex/lib/resumable_stream_context"
        )
        const streamContext = getResumableStreamContext()
        const onStop = vi.fn()
        const source = new ReadableStream<string>({
            start() {
                // Stays open: the generation only ends when stop aborts it.
            }
        })

        await streamContext?.createNewResumableStream("stream-1", () => source, { onStop })
        const resumedStream = await streamContext?.resumeExistingStream("stream-1")
        const reader = resumedStream?.getReader()

        await streamContext?.requestStreamStop("stream-1")

        await waitFor(() => onStop.mock.calls.length > 0, 3_000)
        await expect(reader?.read()).resolves.toEqual({
            done: true,
            value: undefined
        })
    })

    it("does not resurrect a missing stream state when a stop is requested", async () => {
        const { getResumableStreamContext } = await import(
            "../../convex/lib/resumable_stream_context"
        )
        const streamContext = getResumableStreamContext()

        await streamContext?.requestStreamStop("stream-unknown")

        expect(mocks.values.has("resumable-stream:rs:state:stream-unknown")).toBe(false)
    })

    it("closes an idle replay whose writer died without marking the stream done", async () => {
        vi.useFakeTimers()
        try {
            const { getResumableStreamContext } = await import(
                "../../convex/lib/resumable_stream_context"
            )
            const streamContext = getResumableStreamContext()
            mocks.values.set("resumable-stream:rs:state:stream-1", "ACTIVE")

            const resumedStream = await streamContext?.resumeExistingStream("stream-1")
            const read = resumedStream?.getReader().read()

            await vi.advanceTimersByTimeAsync(6 * 60_000)

            await expect(read).resolves.toEqual({
                done: true,
                value: undefined
            })
        } finally {
            vi.useRealTimers()
        }
    })
})
