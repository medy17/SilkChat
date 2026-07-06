// @vitest-environment jsdom

import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { type AutoResumeProps, useAutoResume } from "@/hooks/use-auto-resume"
import { useChatStore } from "@/lib/chat-store"

const resetChatStore = () => {
    useChatStore.setState({
        threadId: undefined,
        uploadedFiles: [],
        rerenderTrigger: "rerender-1",
        lastProcessedDataIndex: -1,
        shouldUpdateQuery: false,
        skipNextDataCheck: true,
        attachedStreamIds: {},
        pendingStreams: {},
        pendingStreamOwnerClientIds: {},
        manuallyStoppedThreads: {},
        targetFromMessageId: undefined,
        targetMode: "normal",
        uploading: false,
        pendingBranchRetry: undefined,
        pendingBranchHydration: undefined,
        pendingBranchGenerations: {}
    })
}

const liveThread = {
    isLive: true,
    currentStreamId: "stream-1"
} as NonNullable<AutoResumeProps["thread"]>

describe("useAutoResume", () => {
    beforeEach(() => {
        resetChatStore()
        vi.useFakeTimers()
        vi.spyOn(console, "log").mockImplementation(() => {})
    })

    it("retries resumable live streams up to the capped attempt count", () => {
        const experimentalResume = vi.fn()

        renderHook(() =>
            useAutoResume({
                autoResume: true,
                threadId: "thread-1",
                thread: liveThread,
                experimental_resume: experimentalResume,
                status: "idle",
                threadMessages: [{ _id: "message-1" }]
            })
        )

        vi.advanceTimersByTime(149)
        expect(experimentalResume).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(experimentalResume).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(5_000)
        expect(experimentalResume).toHaveBeenCalledTimes(5)
    })

    it("does not resume while the store still marks the thread as pending", () => {
        useChatStore.getState().setPendingStream("thread-1", true)
        const experimentalResume = vi.fn()

        renderHook(() =>
            useAutoResume({
                autoResume: true,
                threadId: "thread-1",
                thread: liveThread,
                experimental_resume: experimentalResume,
                status: "idle",
                threadMessages: [{ _id: "message-1" }]
            })
        )

        vi.advanceTimersByTime(5_000)

        expect(experimentalResume).not.toHaveBeenCalled()
    })

    it("resumes when a different client owns the pending stream", () => {
        useChatStore.getState().setPendingStream("thread-1", true, "client-owner")
        const experimentalResume = vi.fn()

        renderHook(() =>
            useAutoResume({
                autoResume: true,
                threadId: "thread-1",
                thread: liveThread,
                experimental_resume: experimentalResume,
                status: "idle",
                threadMessages: [{ _id: "message-1" }],
                clientId: "client-observer"
            })
        )

        vi.advanceTimersByTime(150)

        expect(experimentalResume).toHaveBeenCalledTimes(1)
    })

    it("does not reconnect while an active stream has recent activity", () => {
        const experimentalResume = vi.fn()
        const { rerender } = renderHook(
            (props: { streamActivityKey: string; status: string }) =>
                useAutoResume({
                    autoResume: true,
                    threadId: "thread-1",
                    thread: liveThread,
                    experimental_resume: experimentalResume,
                    status: props.status,
                    threadMessages: [{ _id: "message-1" }],
                    streamActivityKey: props.streamActivityKey
                }),
            {
                initialProps: {
                    streamActivityKey: "",
                    status: "idle"
                }
            }
        )

        vi.advanceTimersByTime(150)
        expect(experimentalResume).toHaveBeenCalledTimes(1)

        rerender({
            streamActivityKey: "assistant:partial-content",
            status: "streaming"
        })
        vi.advanceTimersByTime(3_999)

        expect(experimentalResume).toHaveBeenCalledTimes(1)
    })

    it("reconnects a stale local stream while the backend stream is still live", () => {
        const experimentalResume = vi.fn()
        const stopLocalStream = vi.fn()

        renderHook(() =>
            useAutoResume({
                autoResume: true,
                threadId: "thread-1",
                thread: liveThread,
                experimental_resume: experimentalResume,
                status: "streaming",
                threadMessages: [{ _id: "message-1" }],
                streamActivityKey: "assistant:partial-content",
                stopLocalStream
            })
        )

        vi.advanceTimersByTime(7_999)
        expect(experimentalResume).not.toHaveBeenCalled()
        expect(stopLocalStream).not.toHaveBeenCalled()

        vi.advanceTimersByTime(101)
        expect(experimentalResume).toHaveBeenCalledTimes(1)
        // The stale local stream is torn down before re-attaching so two
        // streams never feed the same message.
        expect(stopLocalStream).toHaveBeenCalledTimes(1)
    })

    it("does not resume when the thread was manually stopped by the user", () => {
        useChatStore.getState().setManuallyStoppedThread("thread-1", true)
        const experimentalResume = vi.fn()

        renderHook(() =>
            useAutoResume({
                autoResume: true,
                threadId: "thread-1",
                thread: liveThread,
                experimental_resume: experimentalResume,
                status: "idle",
                threadMessages: [{ _id: "message-1" }]
            })
        )

        vi.advanceTimersByTime(5_000)

        expect(experimentalResume).not.toHaveBeenCalled()
    })

    it("waits for resolved thread messages before attempting a resume", () => {
        const experimentalResume = vi.fn()
        const { rerender } = renderHook(
            (props: { threadMessages?: AutoResumeProps["threadMessages"] }) =>
                useAutoResume({
                    autoResume: true,
                    threadId: "thread-1",
                    thread: liveThread,
                    experimental_resume: experimentalResume,
                    status: "idle",
                    threadMessages: props.threadMessages
                }),
            {
                initialProps: {
                    threadMessages: undefined
                }
            }
        )

        vi.advanceTimersByTime(2_000)
        expect(experimentalResume).not.toHaveBeenCalled()

        rerender({
            threadMessages: [{ _id: "message-1" }]
        })

        vi.advanceTimersByTime(150)
        expect(experimentalResume).toHaveBeenCalledTimes(1)
    })
})
