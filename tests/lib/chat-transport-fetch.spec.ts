import { createChatTransportFetch } from "@/lib/chat-transport-fetch"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("createChatTransportFetch", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("aborts a reconnect request that does not receive response headers in time", async () => {
        vi.useFakeTimers()
        const fetchImplementation = vi.fn<typeof globalThis.fetch>(
            (_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        reject(new DOMException("The operation was aborted", "AbortError"))
                    })
                })
        )
        const transportFetch = createChatTransportFetch(fetchImplementation, 1_000)

        const request = transportFetch("/chat?chatId=thread-1", { method: "GET" })
        const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" })
        await vi.advanceTimersByTimeAsync(1_000)

        await rejection
    })

    it("does not impose the reconnect timeout on message sends", async () => {
        vi.useFakeTimers()
        const response = new Response(null, { status: 200 })
        const fetchImplementation = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(response))
        const transportFetch = createChatTransportFetch(fetchImplementation, 1_000)

        await expect(transportFetch("/chat", { method: "POST" })).resolves.toBe(response)

        expect(fetchImplementation.mock.calls[0]?.[1]?.signal).toBeUndefined()
        expect(vi.getTimerCount()).toBe(0)
    })
})
