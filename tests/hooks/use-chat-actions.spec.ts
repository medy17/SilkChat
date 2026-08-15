// @vitest-environment jsdom

import type { SharedModel } from "@/convex/lib/models"
import { act, renderHook } from "@testing-library/react"
import type { FileUIPart, UIMessage } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
    branchThreadMutationMock,
    browserEnvMock,
    deleteFileMutationMock,
    nanoidMock,
    navigateMock,
    prepareThreadRetryMutationMock,
    toastErrorMock,
    useMutationMock
} = vi.hoisted(() => ({
    branchThreadMutationMock: vi.fn(),
    browserEnvMock: vi.fn(),
    deleteFileMutationMock: vi.fn(),
    nanoidMock: vi.fn(),
    navigateMock: vi.fn(),
    prepareThreadRetryMutationMock: vi.fn(),
    toastErrorMock: vi.fn(),
    useMutationMock: vi.fn()
}))

vi.mock("convex/react", () => ({
    useMutation: useMutationMock
}))

vi.mock("nanoid", () => ({
    nanoid: nanoidMock
}))

vi.mock("@/convex/_generated/api", () => ({
    api: {
        attachments: {
            deleteFile: "deleteFile"
        },
        threads: {
            branchThread: "branchThread",
            prepareThreadRetry: "prepareThreadRetry"
        }
    }
}))

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => navigateMock
}))

vi.mock("sonner", () => ({
    toast: {
        error: toastErrorMock
    }
}))

vi.mock("@/lib/browser-env", () => ({
    browserEnv: browserEnvMock,
    optionalBrowserEnv: vi.fn((key: string) =>
        key === "VITE_R2_PUBLIC_BASE_URL" ? "https://r2.silkchat.dev" : undefined
    )
}))

import { useChatActions } from "@/hooks/use-chat-actions"
import { useChatStore } from "@/lib/chat-store"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import { useModelStore } from "@/lib/model-store"

type TestMessage = UIMessage

const createModel = (overrides: Partial<SharedModel>): SharedModel =>
    ({
        id: "test-model",
        name: "Test Model",
        adapters: ["openrouter:vendor/model"],
        abilities: [],
        ...overrides
    }) as SharedModel

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
    useModelStore.setState({
        selectedModel: "current-model",
        reasoningEffort: "off",
        enabledTools: ["web_search"],
        selectedImageSize: "1024x1024",
        selectedImageResolution: "1K"
    })
}

describe("useChatActions", () => {
    beforeEach(() => {
        resetChatStore()
        browserEnvMock.mockReset()
        branchThreadMutationMock.mockReset()
        deleteFileMutationMock.mockReset()
        navigateMock.mockReset()
        nanoidMock.mockReset()
        prepareThreadRetryMutationMock.mockReset()
        toastErrorMock.mockReset()
        useMutationMock.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "log").mockImplementation(() => {})

        browserEnvMock.mockImplementation((key: string) => {
            switch (key) {
                case "VITE_R2_PUBLIC_BASE_URL":
                    return "https://r2.silkchat.dev"
                default:
                    return "https://convex.example"
            }
        })
        nanoidMock.mockReturnValue("generated-message-id")
        useMutationMock.mockImplementation((mutation) => {
            if (mutation === "branchThread") return branchThreadMutationMock
            if (mutation === "prepareThreadRetry") return prepareThreadRetryMutationMock
            return deleteFileMutationMock
        })
        deleteFileMutationMock.mockResolvedValue(undefined)
        branchThreadMutationMock.mockResolvedValue({
            threadId: "branch-thread-1",
            projectId: undefined,
            targetRole: "user"
        })
        prepareThreadRetryMutationMock.mockResolvedValue({ assistantMessageId: "m2" })
        navigateMock.mockResolvedValue(undefined)
        useMessageFooterStore.setState({ footerMetadataByMessageId: {} })
    })

    it("stops the active stream instead of sending a new message while streaming", () => {
        const sendMessage = vi.fn()
        const stop = vi.fn()
        const stopRemoteStream = vi.fn()

        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                fallbackModelId: undefined,
                chat: {
                    status: "streaming",
                    sendMessage,
                    stop,
                    stopRemoteStream,
                    messages: [],
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        result.current.handleInputSubmit("hello")

        expect(stop).toHaveBeenCalledTimes(1)
        expect(stopRemoteStream).toHaveBeenCalledTimes(1)
        expect(sendMessage).not.toHaveBeenCalled()
        expect(useChatStore.getState().pendingStreams["thread-1"]).toBe(false)
        expect(useChatStore.getState().manuallyStoppedThreads["thread-1"]).toBe(true)
    })

    it("sends from a passive viewer when only the raw stream status is stale", () => {
        const sendMessage = vi.fn()
        const stop = vi.fn()

        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                fallbackModelId: undefined,
                chat: {
                    clientId: "client-viewer",
                    status: "streaming",
                    composerStatus: "ready",
                    sendMessage,
                    stop,
                    messages: [],
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        result.current.handleInputSubmit("hello from viewer")

        expect(stop).not.toHaveBeenCalled()
        expect(sendMessage).toHaveBeenCalledWith({
            id: "generated-message-id",
            role: "user",
            parts: [
                {
                    type: "text",
                    text: "hello from viewer"
                }
            ]
        })
        expect(useChatStore.getState().pendingStreams["thread-1"]).toBe(true)
        expect(useChatStore.getState().pendingStreamOwnerClientIds["thread-1"]).toBe(
            "client-viewer"
        )
    })

    it("sends trimmed input plus uploaded files and clears the store", () => {
        const sendMessage = vi.fn()

        useChatStore.getState().setUploadedFiles([
            {
                key: "file-1",
                fileName: "notes.txt",
                fileType: "text/plain",
                fileSize: 10,
                uploadedAt: 1
            }
        ])

        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                fallbackModelId: undefined,
                chat: {
                    status: "idle",
                    sendMessage,
                    stop: vi.fn(),
                    messages: [],
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        result.current.handleInputSubmit("  hello world  ")

        expect(sendMessage).toHaveBeenCalledWith({
            id: "generated-message-id",
            role: "user",
            parts: [
                {
                    type: "file",
                    url: "https://r2.silkchat.dev/file-1",
                    mediaType: "text/plain",
                    filename: "notes.txt"
                },
                {
                    type: "text",
                    text: "hello world"
                }
            ]
        })
        expect(useChatStore.getState().pendingStreams["thread-1"]).toBe(true)
        expect(useChatStore.getState().manuallyStoppedThreads["thread-1"]).toBe(false)
        expect(useChatStore.getState().uploadedFiles).toEqual([])
    })

    it("sends a large-paste tile with inline content and preserved tile semantics", () => {
        const sendMessage = vi.fn()
        const inlineDataUrl =
            "data:text/markdown;charset=utf-8,%3Cfile%20converted-by%3D%22anydoc-wasm%22%3Eslides%3C%2Ffile%3E"

        useChatStore.getState().setUploadedFiles([
            {
                key: "inline-document:1",
                fileName: "slides.pptx",
                fileType: "text/markdown",
                fileSize: 10,
                uploadedAt: 1,
                tileKind: "large-paste",
                inlineDataUrl
            }
        ])

        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                fallbackModelId: undefined,
                chat: {
                    status: "idle",
                    sendMessage,
                    stop: vi.fn(),
                    messages: [],
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        result.current.handleInputSubmit("summarise")

        expect(sendMessage).toHaveBeenCalledWith({
            id: "generated-message-id",
            role: "user",
            parts: [
                {
                    type: "file",
                    url: inlineDataUrl,
                    mediaType: "text/markdown;silkchat=large-paste",
                    filename: "slides.pptx"
                },
                { type: "text", text: "summarise" }
            ]
        })
    })

    it("waits for the destructive server mutation before regenerating", async () => {
        const setMessages = vi.fn()
        const regenerate = vi.fn()
        const originalMessages: TestMessage[] = [
            { id: "m1", role: "user", parts: [] },
            {
                id: "m2",
                role: "assistant",
                parts: [{ type: "text", text: "old answer" }],
                metadata: {
                    modelId: "claude-opus-4.6",
                    reasoningEffort: "high"
                }
            },
            { id: "m3", role: "user", parts: [] }
        ]

        useChatStore.setState({
            targetFromMessageId: "old-target",
            targetMode: "edit"
        })

        let resolvePreparation: ((result: { assistantMessageId: string }) => void) | undefined
        prepareThreadRetryMutationMock.mockReturnValue(
            new Promise((resolve) => {
                resolvePreparation = resolve
            })
        )
        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [{ id: "model-override" }],
                fallbackModelId: undefined,
                chat: {
                    status: "idle",
                    sendMessage: vi.fn(),
                    stop: vi.fn(),
                    messages: originalMessages,
                    setMessages,
                    regenerate
                }
            })
        )

        useMessageFooterStore.getState().setFooterMetadata("m2", {
            modelName: "Old model",
            completionTokens: 100
        })

        result.current.handleRetry(originalMessages[0], {
            modelIdOverride: "model-override"
        })

        expect(prepareThreadRetryMutationMock).toHaveBeenCalledWith({
            threadId: "thread-1",
            targetFromMessageId: "m1"
        })
        expect(setMessages).not.toHaveBeenCalled()
        expect(regenerate).not.toHaveBeenCalled()
        expect(useChatStore.getState().pendingStreams["thread-1"]).not.toBe(true)
        expect(useMessageFooterStore.getState().footerMetadataByMessageId.m2).toBeUndefined()

        await act(async () => {
            resolvePreparation?.({ assistantMessageId: "m2" })
            await Promise.resolve()
        })

        expect(useChatStore.getState().pendingStreams["thread-1"]).toBe(true)
        expect(useChatStore.getState().manuallyStoppedThreads["thread-1"]).toBe(false)
        expect(useChatStore.getState().targetFromMessageId).toBeUndefined()
        expect(useChatStore.getState().targetMode).toBe("normal")
        expect(useMessageFooterStore.getState().footerMetadataByMessageId.m2).toBeUndefined()
        expect(regenerate).toHaveBeenCalledWith({
            messageId: "m1",
            body: {
                targetMode: "retry",
                targetFromMessageId: "m1",
                modelIdOverride: "model-override",
                reasoningEffortOverride: "high"
            }
        })
    })

    it("branches from a finished assistant response and navigates to the new thread", async () => {
        const messages: TestMessage[] = [
            { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
            { id: "m2", role: "assistant", parts: [] }
        ]

        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                fallbackModelId: undefined,
                chat: {
                    status: "idle",
                    sendMessage: vi.fn(),
                    stop: vi.fn(),
                    messages,
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        await act(async () => {
            await result.current.handleBranch(messages[1])
        })

        expect(branchThreadMutationMock).toHaveBeenCalledWith({
            threadId: "thread-1",
            messageId: "m2"
        })
        expect(useChatStore.getState().pendingBranchRetry).toBeUndefined()
        expect(useChatStore.getState().pendingBranchHydration).toEqual({
            threadId: "branch-thread-1",
            messages
        })
        expect(useChatStore.getState().pendingBranchGenerations).toEqual({})
        expect(navigateMock).toHaveBeenCalledWith({
            to: "/thread/$threadId",
            params: { threadId: "branch-thread-1" }
        })
    })

    it("does not branch directly from a user message", async () => {
        const messages: TestMessage[] = [{ id: "m1", role: "user", parts: [] }]

        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                fallbackModelId: undefined,
                chat: {
                    status: "idle",
                    sendMessage: vi.fn(),
                    stop: vi.fn(),
                    messages,
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        await act(async () => {
            await result.current.handleBranch(messages[0])
        })

        expect(branchThreadMutationMock).not.toHaveBeenCalled()
        expect(navigateMock).not.toHaveBeenCalled()
    })

    it("retries with the persisted assistant config when retry same is used", () => {
        const setMessages = vi.fn()
        const regenerate = vi.fn()
        const messages: TestMessage[] = [
            { id: "u1", role: "user", parts: [] },
            {
                id: "a1",
                role: "assistant",
                parts: [],
                metadata: {
                    modelId: "claude-opus-4.6",
                    reasoningEffort: "high"
                }
            }
        ]

        const { result } = renderHook(() =>
            useChatActions({
                threadId: undefined,
                sharedModels: [],
                availableModels: [{ id: "claude-opus-4.6" }],
                fallbackModelId: "fallback-model",
                chat: {
                    status: "idle",
                    sendMessage: vi.fn(),
                    stop: vi.fn(),
                    messages,
                    setMessages,
                    regenerate
                }
            })
        )

        result.current.handleRetry(messages[0])

        expect(useModelStore.getState().selectedModel).toBe("claude-opus-4.6")
        expect(useModelStore.getState().reasoningEffort).toBe("high")
        expect(regenerate).toHaveBeenCalledWith({
            messageId: "u1",
            body: {
                targetMode: "retry",
                targetFromMessageId: "u1",
                modelIdOverride: "claude-opus-4.6",
                reasoningEffortOverride: "high"
            }
        })
    })

    it("resolves sunset retry targets before regenerating", () => {
        const setMessages = vi.fn()
        const regenerate = vi.fn()
        const messages: TestMessage[] = [
            { id: "u1", role: "user", parts: [] },
            {
                id: "a1",
                role: "assistant",
                parts: [],
                metadata: {
                    modelId: "old-model",
                    reasoningEffort: "off"
                }
            }
        ]
        const oldModel = createModel({
            id: "old-model",
            abilities: ["reasoning", "effort_control"],
            sunsetOn: "2026-01-01",
            replacementId: "new-model"
        })
        const newModel = createModel({
            id: "new-model",
            abilities: ["reasoning", "effort_control"],
            reasoningEfforts: ["minimal", "low", "medium", "high"],
            defaultReasoningEffort: "minimal"
        })

        const { result } = renderHook(() =>
            useChatActions({
                threadId: undefined,
                sharedModels: [oldModel, newModel],
                availableModels: [{ id: "new-model" }],
                fallbackModelId: "new-model",
                chat: {
                    status: "idle",
                    sendMessage: vi.fn(),
                    stop: vi.fn(),
                    messages,
                    setMessages,
                    regenerate
                }
            })
        )

        result.current.handleRetry(messages[0])

        expect(useModelStore.getState().selectedModel).toBe("new-model")
        expect(useModelStore.getState().reasoningEffort).toBe("minimal")
        expect(regenerate).toHaveBeenCalledWith({
            messageId: "u1",
            body: {
                targetMode: "retry",
                targetFromMessageId: "u1",
                modelIdOverride: "new-model",
                reasoningEffortOverride: "minimal"
            }
        })
    })

    it("updates edited messages and deletes removed attachments before regenerating", async () => {
        const setMessages = vi.fn()
        const regenerate = vi.fn()
        const messages: TestMessage[] = [
            { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
            {
                id: "m2",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://r2.silkchat.dev/file-1",
                        mediaType: "text/plain",
                        filename: "notes.txt"
                    },
                    { type: "text", text: "before" }
                ]
            },
            { id: "m3", role: "assistant", parts: [{ type: "text", text: "after" }] }
        ]

        const remainingFileParts: FileUIPart[] = [
            {
                type: "file",
                url: "https://r2.silkchat.dev/file-2",
                mediaType: "text/plain",
                filename: "kept.txt"
            }
        ]

        const { result } = renderHook(() =>
            useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                fallbackModelId: undefined,
                chat: {
                    status: "idle",
                    sendMessage: vi.fn(),
                    stop: vi.fn(),
                    messages,
                    setMessages,
                    regenerate
                }
            })
        )

        useMessageFooterStore.getState().setFooterMetadata("m3", {
            modelName: "Old model",
            completionTokens: 100
        })

        result.current.handleEditAndRetry("m2", "after edit", remainingFileParts, [
            "https://r2.silkchat.dev/file-1",
            "not-a-url"
        ])

        expect(deleteFileMutationMock).toHaveBeenCalledWith({
            key: "file-1"
        })
        expect(setMessages.mock.invocationCallOrder[0]).toBeLessThan(
            regenerate.mock.invocationCallOrder[0]
        )
        expect(useChatStore.getState().pendingStreams["thread-1"]).toBe(true)
        expect(useChatStore.getState().manuallyStoppedThreads["thread-1"]).toBe(false)
        expect(useMessageFooterStore.getState().footerMetadataByMessageId.m3).toBeUndefined()
        expect(setMessages).toHaveBeenCalledWith([
            messages[0],
            expect.objectContaining({
                parts: [
                    ...remainingFileParts,
                    {
                        type: "text",
                        text: "after edit"
                    }
                ]
            })
        ])
        expect(regenerate).toHaveBeenCalledWith({
            messageId: "m2",
            body: {
                targetMode: "edit",
                targetFromMessageId: "m2"
            }
        })
    })
})
