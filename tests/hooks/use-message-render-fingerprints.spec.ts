// @vitest-environment jsdom

import { useMessageRenderFingerprints } from "@/hooks/use-message-render-fingerprints"
import { renderHook } from "@testing-library/react"
import type { UIMessage } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"

const postMessageMock = vi.fn()

class WorkerMock {
    postMessage = postMessageMock
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    terminate = vi.fn()
}

describe("useMessageRenderFingerprints", () => {
    beforeEach(() => {
        postMessageMock.mockReset()
        vi.stubGlobal("Worker", WorkerMock)
    })

    it("does not send the live message to the worker until it becomes static", () => {
        const initialMessage: UIMessage = {
            id: "assistant-1",
            role: "assistant",
            parts: [{ type: "text", text: "Hello" }]
        }
        const streamedMessage: UIMessage = {
            ...initialMessage,
            parts: [{ type: "text", text: "Hello world" }]
        }

        const { rerender } = renderHook(
            ({ message, liveMessageId }: { message: UIMessage; liveMessageId?: string }) =>
                useMessageRenderFingerprints([message], { liveMessageId }),
            {
                initialProps: {
                    message: initialMessage,
                    liveMessageId: "assistant-1" as string | undefined
                }
            }
        )

        rerender({ message: streamedMessage, liveMessageId: "assistant-1" })
        expect(postMessageMock).not.toHaveBeenCalled()

        rerender({ message: streamedMessage, liveMessageId: undefined })
        expect(postMessageMock).toHaveBeenCalledTimes(1)
        expect(postMessageMock).toHaveBeenCalledWith({
            messages: [
                expect.objectContaining({
                    message: streamedMessage
                })
            ]
        })
    })
})
