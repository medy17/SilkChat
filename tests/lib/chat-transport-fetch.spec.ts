import { createChatTransportFetch } from "@/lib/chat-transport-fetch"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CHAT_ACCEPTED_HEADER, observeChatSubmission } from "@/lib/chat-submission"

describe("createChatTransportFetch", () => {
    it.each([200, 400])(
        "accepts a durably saved message even when stream setup returns %s",
        async (status) => {
            const transport = createChatTransportFetch(
                async () =>
                    new Response(null, { status, headers: { [CHAT_ACCEPTED_HEADER]: "thread-1" } })
            )
            const result = observeChatSubmission(`send-${status}`, () =>
                transport("/chat", {
                    method: "POST",
                    body: JSON.stringify({ submissionId: `send-${status}` })
                })
            )
            await expect(result).resolves.toEqual({
                accepted: true,
                threadId: "thread-1",
                ...(status === 400 ? { streamSetupFailed: true } : {})
            })
        }
    )
    it("does not infer persistence from a resolved SDK promise or a rejected request", async () => {
        await expect(observeChatSubmission("sdk-error", async () => undefined)).resolves.toEqual({
            accepted: false
        })
        const transport = createChatTransportFetch(async () => new Response(null, { status: 400 }))
        await expect(
            observeChatSubmission("rejected", () =>
                transport("/chat", {
                    method: "POST",
                    body: JSON.stringify({ submissionId: "rejected" })
                })
            )
        ).resolves.toEqual({ accepted: false })
    })
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
