// @vitest-environment jsdom

import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { useNavigateMock } = vi.hoisted(() => ({
    useNavigateMock: vi.fn()
}))

vi.mock("@tanstack/react-router", () => ({
    useNavigate: useNavigateMock
}))

import { useChatDataProcessor } from "@/hooks/use-chat-data-processor"
import { useChatStore } from "@/lib/chat-store"

type ProcessorMessages = Parameters<typeof useChatDataProcessor>[0]["messages"]

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
        selectedPersona: { source: "default" },
        pendingBranchRetry: undefined,
        pendingBranchHydration: undefined,
        pendingBranchGenerations: {}
    })
}

describe("useChatDataProcessor", () => {
    beforeEach(() => {
        resetChatStore()
        useNavigateMock.mockReset()
        vi.spyOn(console, "log").mockImplementation(() => {})
    })

    it("hydrates thread and stream metadata into the real chat store", () => {
        const navigate = vi.fn()
        useNavigateMock.mockReturnValue(navigate)

        Object.defineProperty(window, "location", {
            configurable: true,
            value: {
                pathname: "/thread/thread-1"
            }
        })

        renderHook(() =>
            useChatDataProcessor({
                status: "ready",
                messages: [
                    {
                        id: "assistant-1",
                        role: "assistant",
                        metadata: {
                            threadId: "thread-1",
                            streamId: "stream-1"
                        }
                    }
                ] as ProcessorMessages,
                folderId: undefined
            })
        )

        expect(useChatStore.getState().threadId).toBe("thread-1")
        expect(useChatStore.getState().shouldUpdateQuery).toBe(true)
        expect(useChatStore.getState().attachedStreamIds).toEqual({
            "thread-1": ["stream-1"]
        })
        expect(navigate).not.toHaveBeenCalled()
    })

    it("does not clear pending state owned by another client", () => {
        const navigate = vi.fn()
        useNavigateMock.mockReturnValue(navigate)
        useChatStore.getState().setPendingStream("thread-1", true, "client-owner")
        useChatStore.setState({ threadId: "thread-1" })

        Object.defineProperty(window, "location", {
            configurable: true,
            value: {
                pathname: "/thread/thread-1"
            }
        })

        renderHook(() =>
            useChatDataProcessor({
                status: "ready",
                clientId: "client-observer",
                messages: [
                    {
                        id: "assistant-1",
                        role: "assistant",
                        metadata: {
                            threadId: "thread-1",
                            streamId: "stream-1"
                        }
                    }
                ] as ProcessorMessages,
                folderId: undefined
            })
        )

        expect(useChatStore.getState().pendingStreams["thread-1"]).toBe(true)
        expect(useChatStore.getState().pendingStreamOwnerClientIds["thread-1"]).toBe("client-owner")
    })

    it("canonicalizes a root new chat only after the initial response settles", () => {
        const navigate = vi.fn()
        useNavigateMock.mockReturnValue(navigate)

        Object.defineProperty(window, "location", {
            configurable: true,
            value: {
                pathname: "/"
            }
        })

        const { rerender } = renderHook(
            (status: string) =>
                useChatDataProcessor({
                    status,
                    messages: [
                        {
                            id: "assistant-1",
                            role: "assistant",
                            metadata: {
                                threadId: "thread-2"
                            }
                        }
                    ] as ProcessorMessages,
                    folderId: undefined
                }),
            {
                initialProps: "streaming"
            }
        )

        expect(navigate).not.toHaveBeenCalled()

        rerender("ready")

        expect(navigate).toHaveBeenCalledWith({
            to: "/thread/$threadId",
            params: { threadId: "thread-2" },
            replace: true
        })
    })

    it("canonicalizes a folder new chat to the folder thread route after settling", () => {
        const navigate = vi.fn()
        useNavigateMock.mockReturnValue(navigate)

        Object.defineProperty(window, "location", {
            configurable: true,
            value: {
                pathname: "/folder/folder-1"
            }
        })

        const { rerender } = renderHook(
            (status: string) =>
                useChatDataProcessor({
                    status,
                    messages: [
                        {
                            id: "assistant-1",
                            role: "assistant",
                            metadata: {
                                threadId: "thread-2"
                            }
                        }
                    ] as ProcessorMessages,
                    folderId: "folder-1"
                }),
            {
                initialProps: "streaming"
            }
        )

        expect(navigate).not.toHaveBeenCalled()

        rerender("ready")

        expect(navigate).toHaveBeenCalledWith({
            to: "/folder/$folderId/thread/$threadId",
            params: { folderId: "folder-1", threadId: "thread-2" },
            replace: true
        })
    })
})
