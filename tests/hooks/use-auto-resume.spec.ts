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

    it("rate-limits resume attempts and opens a new retry window", async () => {
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

        await vi.advanceTimersByTimeAsync(149)
        expect(experimentalResume).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1)
        expect(experimentalResume).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(5_000)
        expect(experimentalResume).toHaveBeenCalledTimes(5)

        await vi.advanceTimersByTimeAsync(24_000)
        expect(experimentalResume).toHaveBeenCalledTimes(5)

        await vi.advanceTimersByTimeAsync(2_000)
        expect(experimentalResume).toHaveBeenCalledTimes(6)
    })

    it("does not overlap reconnect attempts while one is still pending", async () => {
        let finishResume: (() => void) | undefined
        const experimentalResume = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finishResume = resolve
                })
        )

        renderHook(() =>
            useAutoResume({
                autoResume: true,
                threadId: "thread-1",
                thread: liveThread,
                experimental_resume: experimentalResume,
                status: "idle",
                threadMessages: [{ _id: "message-1" }],
                localChatId: "chat-1"
            })
        )

        await vi.advanceTimersByTimeAsync(5_000)
        expect(experimentalResume).toHaveBeenCalledTimes(1)

        finishResume?.()
        await Promise.resolve()
        await vi.advanceTimersByTimeAsync(900)

        expect(experimentalResume).toHaveBeenCalledTimes(2)
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

    it("recreates a stale local chat before reconnecting its live backend stream", async () => {
        const experimentalResume = vi.fn()
        const restartLocalChat = vi.fn()

        const { rerender } = renderHook(
            (props: { localChatId: string; status: string }) =>
                useAutoResume({
                    autoResume: true,
                    threadId: "thread-1",
                    thread: liveThread,
                    experimental_resume: experimentalResume,
                    status: props.status,
                    threadMessages: [{ _id: "message-1" }],
                    streamActivityKey: "assistant:partial-content",
                    localChatId: props.localChatId,
                    restartLocalChat
                }),
            {
                initialProps: {
                    localChatId: "chat-1",
                    status: "streaming"
                }
            }
        )

        await vi.advanceTimersByTimeAsync(7_999)
        expect(experimentalResume).not.toHaveBeenCalled()
        expect(restartLocalChat).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(101)
        expect(restartLocalChat).toHaveBeenCalledTimes(1)
        expect(experimentalResume).not.toHaveBeenCalled()

        rerender({ localChatId: "chat-2", status: "idle" })
        await vi.advanceTimersByTimeAsync(150)

        expect(experimentalResume).toHaveBeenCalledTimes(1)
        expect(restartLocalChat).toHaveBeenCalledTimes(1)
    })

    it("does not replay a healthy direct send after a long tool-execution gap", async () => {
        const experimentalResume = vi.fn()
        const restartLocalChat = vi.fn()

        renderHook(() =>
            useAutoResume({
                autoResume: true,
                threadId: "thread-1",
                thread: liveThread,
                experimental_resume: experimentalResume,
                status: "streaming",
                threadMessages: [{ _id: "message-1" }],
                streamActivityKey: "assistant:waiting-for-tool",
                localChatId: "chat-1",
                restartLocalChat,
                hasDirectSendStream: true
            })
        )

        await vi.advanceTimersByTimeAsync(60_000)

        expect(restartLocalChat).not.toHaveBeenCalled()
        expect(experimentalResume).not.toHaveBeenCalled()
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
                    threadMessages: undefined as AutoResumeProps["threadMessages"]
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
