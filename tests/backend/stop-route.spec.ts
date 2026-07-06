import { beforeEach, describe, expect, it, vi } from "vitest"

const { getResumableStreamContextMock, getUserIdentityMock } = vi.hoisted(() => ({
    getResumableStreamContextMock: vi.fn(),
    getUserIdentityMock: vi.fn()
}))

vi.mock("../../convex/_generated/server", () => ({
    httpAction: (handler: unknown) => handler
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        threads: {
            getThreadById: "getThreadById",
            updateThreadStreamingState: "updateThreadStreamingState"
        }
    }
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/lib/resumable_stream_context", () => ({
    getResumableStreamContext: getResumableStreamContextMock
}))

import { chatDELETE } from "../../convex/chat_http/stop.route"

const chatDELETEHandler = chatDELETE as unknown as (
    ctx: {
        auth: Record<string, never>
        runQuery: ReturnType<typeof vi.fn>
        runMutation: ReturnType<typeof vi.fn>
    },
    request: Request
) => Promise<Response>

type ChatDeleteCtx = Parameters<typeof chatDELETEHandler>[0]

const createCtx = () =>
    ({
        auth: {},
        runQuery: vi.fn(),
        runMutation: vi.fn().mockResolvedValue(null)
    }) as ChatDeleteCtx

const makeRequest = (chatId?: string) =>
    new Request(`https://example.com/chat${chatId ? `?chatId=${chatId}` : ""}`, {
        method: "DELETE"
    })

describe("chatDELETE", () => {
    beforeEach(() => {
        getResumableStreamContextMock.mockReset()
        getUserIdentityMock.mockReset()
    })

    it("rejects requests without a chat id", async () => {
        const response = await chatDELETEHandler(createCtx(), makeRequest())

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            code: "bad_request:api"
        })
    })

    it("rejects users who do not own the thread", async () => {
        const ctx = createCtx()
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        ctx.runQuery.mockResolvedValueOnce({
            _id: "thread-1",
            authorId: "user-2"
        })

        const response = await chatDELETEHandler(ctx, makeRequest("thread-1"))

        expect(response.status).toBe(403)
        expect(ctx.runMutation).not.toHaveBeenCalled()
    })

    it("is a no-op when the thread has no live stream", async () => {
        const ctx = createCtx()
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        ctx.runQuery.mockResolvedValueOnce({
            _id: "thread-1",
            authorId: "user-1",
            isLive: false
        })

        const response = await chatDELETEHandler(ctx, makeRequest("thread-1"))

        expect(response.status).toBe(204)
        expect(ctx.runMutation).not.toHaveBeenCalled()
    })

    it("flags the stream as stopped and clears the live thread state", async () => {
        const ctx = createCtx()
        const requestStreamStop = vi.fn().mockResolvedValue(undefined)
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getResumableStreamContextMock.mockReturnValueOnce({ requestStreamStop })
        ctx.runQuery.mockResolvedValueOnce({
            _id: "thread-1",
            authorId: "user-1",
            isLive: true,
            currentStreamId: "stream-1"
        })

        const response = await chatDELETEHandler(ctx, makeRequest("thread-1"))

        expect(response.status).toBe(204)
        expect(requestStreamStop).toHaveBeenCalledWith("stream-1")
        expect(ctx.runMutation).toHaveBeenCalledWith("updateThreadStreamingState", {
            threadId: "thread-1",
            isLive: false,
            currentStreamId: undefined
        })
    })

    it("still clears the live thread state when Redis is unavailable", async () => {
        const ctx = createCtx()
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        getResumableStreamContextMock.mockReturnValueOnce(null)
        ctx.runQuery.mockResolvedValueOnce({
            _id: "thread-1",
            authorId: "user-1",
            isLive: true,
            currentStreamId: "stream-1"
        })

        const response = await chatDELETEHandler(ctx, makeRequest("thread-1"))

        expect(response.status).toBe(204)
        expect(ctx.runMutation).toHaveBeenCalledWith("updateThreadStreamingState", {
            threadId: "thread-1",
            isLive: false,
            currentStreamId: undefined
        })
    })
})
