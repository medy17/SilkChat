import { settleChatSubmission } from "@/lib/chat-submission"
import { createChatTransportFetch } from "@/lib/chat-transport-fetch"
import type { UploadedFile } from "@/lib/chat-store"
// @vitest-environment jsdom

import type { SharedModel } from "@/convex/lib/models"
import { act, renderHook } from "@testing-library/react"
import { useState } from "react"
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
        success: vi.fn(),
        info: vi.fn(),
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
import { createComposerSession } from "@/lib/composer-session"
import { peekMessageEditRecovery, stashMessageEditRecovery } from "@/lib/message-edit-recovery"
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

    it.each([undefined, "folder-1"])(
        "opens a committed first turn after stream setup fails (folder=%s)",
        async (folderId) => {
            const transport = createChatTransportFetch(
                async () =>
                    new Response("Setup failed", {
                        status: 400,
                        headers: { "X-Silkchat-Accepted-Thread": "saved-thread" }
                    })
            )
            const { result } = renderHook(() =>
                useChatActions({
                    threadId: undefined,
                    folderId,
                    sharedModels: [],
                    availableModels: [],
                    chat: {
                        status: "ready",
                        messages: [],
                        stop: vi.fn(),
                        setMessages: vi.fn(),
                        regenerate: vi.fn(),
                        sendMessage: async (_message, options) => {
                            const response = await transport("https://example.com/chat", {
                                method: "POST",
                                body: JSON.stringify(options?.body)
                            })
                            if (!response.ok) throw new Error("Setup failed")
                        }
                    }
                })
            )
            await act(async () => {
                expect(await result.current.handleInputSubmit("Hello")).toMatchObject({
                    accepted: true,
                    threadId: "saved-thread"
                })
            })
            expect(useChatStore.getState().threadId).toBe("saved-thread")
            expect(navigateMock).toHaveBeenCalledWith(
                folderId
                    ? {
                          to: "/folder/$folderId/thread/$threadId",
                          params: { folderId, threadId: "saved-thread" }
                      }
                    : { to: "/thread/$threadId", params: { threadId: "saved-thread" } }
            )
        }
    )

    it.each(["inactive", "other-thread", "new-chat", "unmounted"])(
        "does not adopt delayed acceptance after the originating surface is %s",
        async (change) => {
            const { result, rerender, unmount } = renderHook(
                ({ isActive, threadId }: { isActive: boolean; threadId?: string }) =>
                    useChatActions({
                        threadId,
                        isActive,
                        sharedModels: [],
                        availableModels: [],
                        chat: {
                            status: "ready",
                            messages: [],
                            sendMessage: () => new Promise(() => {}),
                            stop: vi.fn(),
                            setMessages: vi.fn(),
                            regenerate: vi.fn()
                        }
                    }),
                { initialProps: { isActive: true, threadId: undefined as string | undefined } }
            )
            let sending!: ReturnType<typeof result.current.handleInputSubmit>
            act(() => {
                sending = result.current.handleInputSubmit("Hello")
            })
            if (change === "inactive") rerender({ isActive: false, threadId: undefined })
            if (change === "other-thread") rerender({ isActive: true, threadId: "other" })
            if (change === "new-chat") act(() => useChatStore.getState().resetChat())
            if (change === "unmounted") unmount()
            await act(async () => {
                settleChatSubmission("generated-message-id", {
                    accepted: true,
                    threadId: "saved-thread",
                    streamSetupFailed: true
                })
                await sending
            })
            expect(useChatStore.getState().threadId).not.toBe("saved-thread")
            expect(navigateMock).not.toHaveBeenCalled()
        }
    )

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
        expect(sendMessage.mock.calls[0][0]).toEqual({
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

    it("serializes the explicit attachment payload and trims text", () => {
        const sendMessage = vi.fn()

        const files: UploadedFile[] = [
            {
                key: "file-1",
                fileName: "notes.txt",
                fileType: "text/plain",
                fileSize: 10,
                uploadedAt: 1
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
                    sendMessage,
                    stop: vi.fn(),
                    messages: [],
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        result.current.handleInputSubmit("  hello world  ", files)

        expect(sendMessage.mock.calls[0][0]).toEqual({
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
    })

    it("sends a large-paste tile with inline content and preserved tile semantics", () => {
        const sendMessage = vi.fn()
        const inlineDataUrl =
            "data:text/markdown;charset=utf-8,%3Cfile%20converted-by%3D%22anydoc-wasm%22%3Eslides%3C%2Ffile%3E"

        const files: UploadedFile[] = [
            {
                key: "inline-document:1",
                fileName: "slides.pptx",
                fileType: "text/markdown",
                fileSize: 10,
                uploadedAt: 1,
                tileKind: "large-paste",
                inlineDataUrl
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
                    sendMessage,
                    stop: vi.fn(),
                    messages: [],
                    setMessages: vi.fn(),
                    regenerate: vi.fn()
                }
            })
        )

        result.current.handleInputSubmit("summarise", files)

        expect(sendMessage.mock.calls[0][0]).toEqual({
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

    it("keeps removed attachments until the edit is accepted", async () => {
        const setMessages = vi.fn()
        let finishGeneration!: () => void
        const regenerate = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finishGeneration = resolve
                })
        )
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

        const saved = result.current.handleEditAndRetry("m2", "after edit", remainingFileParts, [
            "https://r2.silkchat.dev/file-1",
            "not-a-url"
        ])

        expect(deleteFileMutationMock).not.toHaveBeenCalled()
        await Promise.resolve()
        expect(deleteFileMutationMock).not.toHaveBeenCalled()
        settleChatSubmission("generated-message-id", {
            accepted: true,
            threadId: "thread-1"
        })
        await expect(saved).resolves.toBe(true)
        finishGeneration()
        expect(deleteFileMutationMock).toHaveBeenCalledWith({ key: "file-1" })
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
                targetFromMessageId: "m2",
                submissionId: expect.any(String)
            }
        })
    })

    it("closes the editor optimistically and reopens it when the edit is rejected", async () => {
        const original: TestMessage[] = [
            { id: "user", role: "user", parts: [{ type: "text", text: "Before" }] },
            { id: "assistant", role: "assistant", parts: [{ type: "text", text: "Reply" }] }
        ]
        const footer = { modelName: "Historical", completionTokens: 30 }
        useMessageFooterStore.getState().setFooterMetadata("assistant", footer)
        useChatStore.setState({ targetFromMessageId: "user", targetMode: "edit" })
        let reject!: (error: Error) => void
        const regenerate = vi.fn(
            () =>
                new Promise<void>((_resolve, rejectPromise) => {
                    reject = rejectPromise
                })
        )
        const { result } = renderHook(() => {
            const [messages, setMessages] = useState(original)
            const actions = useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                chat: {
                    status: "idle",
                    messages,
                    setMessages,
                    regenerate,
                    sendMessage: vi.fn(),
                    stop: vi.fn()
                }
            })
            return { messages, actions }
        })
        let saved!: Promise<boolean>
        act(() => {
            saved = result.current.actions.handleEditAndRetry(
                "user",
                "Edited",
                [],
                ["https://r2.silkchat.dev/removed"]
            )
        })
        expect(result.current.messages).toHaveLength(1)
        expect(useMessageFooterStore.getState().footerMetadataByMessageId.assistant).toBeUndefined()
        expect(useChatStore.getState()).toMatchObject({
            targetFromMessageId: undefined,
            targetMode: "normal"
        })
        await act(async () => {
            reject(new Error("Not saved"))
            await expect(saved).resolves.toBe(false)
        })
        expect(result.current.messages).toEqual(original)
        expect(useMessageFooterStore.getState().footerMetadataByMessageId.assistant).toMatchObject(
            footer
        )
        expect(useChatStore.getState()).toMatchObject({
            targetFromMessageId: "user",
            targetMode: "edit"
        })
        expect(deleteFileMutationMock).not.toHaveBeenCalled()
    })

    it("releases a rejected edit's added attachments when its editor cannot reopen", async () => {
        const original: TestMessage[] = [
            { id: "user", role: "user", parts: [{ type: "text", text: "Before" }] },
            { id: "assistant", role: "assistant", parts: [{ type: "text", text: "Reply" }] }
        ]
        const session = createComposerSession()
        session.setState({ attachments: [{ key: "added-file" } as UploadedFile] })
        stashMessageEditRecovery("user", {
            session,
            text: "Edited",
            deletedUrls: [],
            config: {
                modelId: "current-model",
                reasoningEffort: "off",
                enabledTools: [],
                autoSelectTools: false
            }
        })
        deleteFileMutationMock.mockResolvedValue({ success: true })
        let reject!: (error: Error) => void
        const regenerate = vi.fn(
            () =>
                new Promise<void>((_resolve, rejectPromise) => {
                    reject = rejectPromise
                })
        )
        const { result } = renderHook(() => {
            const [messages, setMessages] = useState(original)
            return useChatActions({
                threadId: "thread-1",
                sharedModels: [],
                availableModels: [],
                chat: {
                    status: "idle",
                    messages,
                    setMessages,
                    regenerate,
                    sendMessage: vi.fn(),
                    stop: vi.fn()
                }
            })
        })
        let saved!: Promise<boolean>
        act(() => {
            saved = result.current.handleEditAndRetry("user", "Edited")
        })
        // The user opened a different edit while this one was pending.
        useChatStore.setState({ targetFromMessageId: "other", targetMode: "edit" })
        await act(async () => {
            reject(new Error("Not saved"))
            await expect(saved).resolves.toBe(false)
        })
        expect(useChatStore.getState().targetFromMessageId).toBe("other")
        expect(peekMessageEditRecovery("user")).toBeUndefined()
        expect(deleteFileMutationMock).toHaveBeenCalledWith({ key: "added-file" })
        expect(toastErrorMock).toHaveBeenCalledWith("Your edit couldn't be saved.")
    })

    it.each(["submitted", "streaming"])(
        "explains why an edit cannot save during a %s response",
        async (composerStatus) => {
            const regenerate = vi.fn()
            const { result } = renderHook(() =>
                useChatActions({
                    threadId: "thread-1",
                    sharedModels: [],
                    availableModels: [],
                    chat: {
                        status: "idle",
                        composerStatus,
                        messages: [{ id: "user", role: "user", parts: [] }],
                        setMessages: vi.fn(),
                        regenerate,
                        sendMessage: vi.fn(),
                        stop: vi.fn()
                    }
                })
            )
            await expect(result.current.handleEditAndRetry("user", "Edited")).resolves.toBe(false)
            expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining("current response"))
            expect(regenerate).not.toHaveBeenCalled()
        }
    )
})
