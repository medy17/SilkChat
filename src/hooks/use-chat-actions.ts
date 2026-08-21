import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { SharedModel } from "@/convex/lib/models"
import {
    type AssistantConfigOverride,
    getRetryTargetAssistantConfig,
    resolveAssistantConfigOverride
} from "@/lib/assistant-config"
import { getAttachmentTileMediaType } from "@/lib/attachment-tile"
import { type ChatMessage, type UploadedFile, useChatStore } from "@/lib/chat-store"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import { useModelStore } from "@/lib/model-store"
import { extractR2KeyFromUrl, getPublicR2AssetUrl } from "@/lib/r2-public-url"
import { captureBrowserEvent } from "@/lib/telemetry/browser"
import { TELEMETRY_EVENTS } from "@/lib/telemetry/events"
import { useNavigate } from "@tanstack/react-router"
import type { FileUIPart, UIMessage } from "ai"
import { useMutation } from "convex/react"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useRef } from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"

type UserTextPart = {
    type: "text"
    text: string
}

type SendableUserMessage = {
    id: string
    role: "user"
    parts: Array<FileUIPart | UserTextPart>
}

interface ChatActionHelpers<TMessage extends UIMessage = UIMessage> {
    clientId?: string
    status: string
    composerStatus?: string
    sendMessage: (message: SendableUserMessage) => Promise<unknown>
    stop: () => void
    stopRemoteStream?: () => void
    messages: TMessage[]
    setMessages: (messages: TMessage[] | ((messages: TMessage[]) => TMessage[])) => unknown
    regenerate: (options?: {
        messageId?: string
        body?: Record<string, unknown>
    }) => Promise<unknown>
}

export function useChatActions<TMessage extends UIMessage>({
    threadId,
    folderId,
    sharedModels,
    availableModels,
    fallbackModelId,
    chat
}: {
    threadId: string | undefined
    folderId?: string
    sharedModels: readonly SharedModel[]
    availableModels: readonly { id: string }[]
    fallbackModelId?: string | null
    chat: ChatActionHelpers<TMessage>
}) {
    const {
        uploadedFiles,
        setUploadedFiles,
        setPendingStream,
        setManuallyStoppedThread,
        setTargetFromMessageId,
        setTargetMode,
        setLastLocalMutationAt,
        setPendingBranchHydration,
        setPendingBranchGeneration
    } = useChatStore()
    const selectedModel = useModelStore((state) => state.selectedModel)
    const reasoningEffort = useModelStore((state) => state.reasoningEffort)
    const setSelectedModel = useModelStore((state) => state.setSelectedModel)
    const setReasoningEffort = useModelStore((state) => state.setReasoningEffort)
    const {
        status,
        composerStatus = status,
        sendMessage,
        stop,
        stopRemoteStream,
        messages,
        setMessages,
        regenerate
    } = chat
    const deleteFileMutation = useMutation(api.attachments.deleteFile)
    const branchThreadMutation = useMutation(api.threads.branchThread)
    const prepareThreadRetryMutation = useMutation(api.threads.prepareThreadRetry)
    const navigate = useNavigate()
    const retryPreparationInFlightRef = useRef(false)
    const generationStartedAtRef = useRef<number | null>(null)

    useEffect(() => {
        if (composerStatus === "submitted" || composerStatus === "streaming") {
            generationStartedAtRef.current ??= Date.now()
            return
        }
        generationStartedAtRef.current = null
    }, [composerStatus])

    const primeMessageUpdates = useCallback(() => {
        if (!threadId) {
            return
        }

        setPendingStream(threadId, true, chat.clientId)
        setManuallyStoppedThread(threadId, false)
        setLastLocalMutationAt(Date.now())
    }, [
        chat.clientId,
        setManuallyStoppedThread,
        setPendingStream,
        setLastLocalMutationAt,
        threadId
    ])

    const primeImmediateMessageUpdates = useCallback(() => {
        flushSync(() => {
            primeMessageUpdates()
        })
    }, [primeMessageUpdates])

    const handleInputSubmit = useCallback(
        (inputValue?: string, fileValues?: UploadedFile[]) => {
            if (composerStatus === "streaming") {
                const lastMessage = messages.at(-1)
                const hadVisibleOutput = Boolean(
                    lastMessage?.role === "assistant" &&
                        lastMessage.parts.some(
                            (part) => part.type === "text" && part.text.trim().length > 0
                        )
                )
                captureBrowserEvent(TELEMETRY_EVENTS.generationStopped, {
                    thread_id: threadId ?? null,
                    message_id: lastMessage?.role === "assistant" ? lastMessage.id : null,
                    model_id: selectedModel,
                    elapsed_ms:
                        generationStartedAtRef.current === null
                            ? null
                            : Date.now() - generationStartedAtRef.current,
                    had_visible_output: hadVisibleOutput
                })
                if (threadId) {
                    setPendingStream(threadId, false)
                    setManuallyStoppedThread(threadId, true)
                }
                stop()
                stopRemoteStream?.()
                return
            }

            if (composerStatus === "submitted") {
                return
            }

            const trimmedInput = inputValue?.trim() ?? ""
            const finalFiles = fileValues ?? uploadedFiles

            if (!trimmedInput && finalFiles.length === 0) {
                return
            }

            primeImmediateMessageUpdates()

            void sendMessage({
                id: nanoid(),
                role: "user",
                parts: [
                    ...finalFiles.map((file) => {
                        return {
                            type: "file",
                            url: file.inlineDataUrl ?? getPublicR2AssetUrl(file.key),
                            mediaType: getAttachmentTileMediaType(file.fileType, file.tileKind),
                            filename: file.fileName
                        } satisfies FileUIPart
                    }),
                    ...(trimmedInput ? [{ type: "text" as const, text: trimmedInput }] : [])
                ]
            })

            setUploadedFiles([])
        },
        [
            sendMessage,
            setManuallyStoppedThread,
            setPendingStream,
            stop,
            stopRemoteStream,
            composerStatus,
            messages,
            selectedModel,
            threadId,
            uploadedFiles,
            setUploadedFiles,
            primeImmediateMessageUpdates
        ]
    )

    const handleRetry = useCallback(
        (message: UIMessage, configOverride?: AssistantConfigOverride) => {
            const messageIndex = messages.findIndex((m) => m.id === message.id)
            if (messageIndex === -1) return
            const retriedAssistantMessageId = messages
                .slice(messageIndex + 1)
                .find((candidate) => candidate.role === "assistant")?.id
            const persistedAssistantConfig = getRetryTargetAssistantConfig(
                messages as Parameters<typeof getRetryTargetAssistantConfig>[0],
                message.id
            )
            const resolvedRetryConfig = resolveAssistantConfigOverride({
                config: {
                    modelId: configOverride?.modelIdOverride ?? persistedAssistantConfig?.modelId,
                    reasoningEffort:
                        configOverride?.reasoningEffortOverride ??
                        persistedAssistantConfig?.reasoningEffort,
                    toolCallLimitFloorOverride: configOverride?.toolCallLimitFloorOverride
                },
                sharedModels,
                availableModels,
                fallbackModelId
            })
            const originalModelId = persistedAssistantConfig?.modelId ?? selectedModel
            const retryModelId = resolvedRetryConfig?.modelIdOverride ?? selectedModel
            const captureRetryRequested = () =>
                captureBrowserEvent(TELEMETRY_EVENTS.retryRequested, {
                    thread_id: threadId ?? null,
                    target_message_id: message.id,
                    retry_type:
                        originalModelId && retryModelId && originalModelId !== retryModelId
                            ? "different_model"
                            : "same_model",
                    original_model_id: originalModelId,
                    selected_model_id: retryModelId
                })

            flushSync(() => {
                setTargetFromMessageId(undefined)
                setTargetMode("normal")
            })
            if (
                resolvedRetryConfig?.modelIdOverride &&
                resolvedRetryConfig.modelIdOverride !== selectedModel
            ) {
                setSelectedModel(resolvedRetryConfig.modelIdOverride)
            }
            if (
                resolvedRetryConfig?.reasoningEffortOverride &&
                resolvedRetryConfig.reasoningEffortOverride !== reasoningEffort
            ) {
                setReasoningEffort(resolvedRetryConfig.reasoningEffortOverride)
            }

            if (!threadId) {
                captureRetryRequested()
                if (retriedAssistantMessageId) {
                    useMessageFooterStore.getState().clearFooterMetadata(retriedAssistantMessageId)
                }
                primeImmediateMessageUpdates()
                void regenerate({
                    messageId: message.id,
                    body: {
                        targetMode: "retry",
                        targetFromMessageId: message.id,
                        ...resolvedRetryConfig
                    }
                })
                return
            }

            if (retryPreparationInFlightRef.current) return
            retryPreparationInFlightRef.current = true
            captureRetryRequested()
            if (retriedAssistantMessageId) {
                useMessageFooterStore.getState().clearFooterMetadata(retriedAssistantMessageId)
            }

            void (async () => {
                try {
                    const result = await prepareThreadRetryMutation({
                        threadId: threadId as Id<"threads">,
                        targetFromMessageId: message.id
                    })
                    if (!result || "error" in result) {
                        throw new Error(
                            typeof result?.error === "string"
                                ? result.error
                                : "Failed to prepare retry"
                        )
                    }

                    if (result.assistantMessageId !== retriedAssistantMessageId) {
                        useMessageFooterStore
                            .getState()
                            .clearFooterMetadata(result.assistantMessageId)
                    }
                    primeMessageUpdates()
                    await regenerate({
                        messageId: message.id,
                        body: {
                            targetMode: "retry",
                            targetFromMessageId: message.id,
                            ...resolvedRetryConfig
                        }
                    })
                } catch (error) {
                    console.error("Failed to retry message:", error)
                    toast.error("Failed to retry message")
                } finally {
                    retryPreparationInFlightRef.current = false
                }
            })()
        },
        [
            availableModels,
            fallbackModelId,
            messages,
            reasoningEffort,
            setReasoningEffort,
            setSelectedModel,
            setTargetFromMessageId,
            setTargetMode,
            sharedModels,
            selectedModel,
            regenerate,
            primeMessageUpdates,
            primeImmediateMessageUpdates,
            prepareThreadRetryMutation,
            threadId
        ]
    )

    const handleEditAndRetry = useCallback(
        (
            messageId: string,
            newContent: string,
            remainingFileParts?: FileUIPart[],
            deletedUrls?: string[]
        ) => {
            const messageIndex = messages.findIndex((m) => m.id === messageId)
            if (messageIndex === -1) return
            const editedAssistantMessageId = messages
                .slice(messageIndex + 1)
                .find((candidate) => candidate.role === "assistant")?.id

            if (deletedUrls && deletedUrls.length > 0) {
                const deletionKeys = deletedUrls
                    .map((url) => extractR2KeyFromUrl(url))
                    .filter((key): key is string => Boolean(key))

                if (deletionKeys.length > 0) {
                    void Promise.allSettled(
                        deletionKeys.map((key) => deleteFileMutation({ key }))
                    ).then((results) => {
                        let deletedCount = 0
                        let alreadyDeletedCount = 0
                        let failedCount = 0

                        for (const result of results) {
                            if (result.status === "rejected") {
                                failedCount += 1
                            } else if (result.value?.success) {
                                deletedCount += 1
                            } else if (result.value?.error === "File not found") {
                                alreadyDeletedCount += 1
                            } else {
                                failedCount += 1
                            }
                        }

                        if (deletedCount > 0) {
                            toast.success(
                                deletedCount === 1
                                    ? "Attachment deleted"
                                    : `${deletedCount} attachments deleted`
                            )
                        }
                        if (alreadyDeletedCount > 0) {
                            toast.info(
                                alreadyDeletedCount === 1
                                    ? "Attachment was already deleted"
                                    : `${alreadyDeletedCount} attachments were already deleted`
                            )
                        }
                        if (failedCount > 0) {
                            toast.error(
                                failedCount === 1
                                    ? "Failed to delete attachment"
                                    : `Failed to delete ${failedCount} attachments`
                            )
                        }
                    })
                }
            }

            // Truncate messages and update the edited message
            const messagesUpToEdit = messages.slice(0, messageIndex)
            const updatedEditedMessage = {
                ...messages[messageIndex],
                content: newContent,
                parts: [...(remainingFileParts || []), { type: "text" as const, text: newContent }]
            }

            if (editedAssistantMessageId) {
                useMessageFooterStore.getState().clearFooterMetadata(editedAssistantMessageId)
            }
            primeImmediateMessageUpdates()
            flushSync(() => {
                setTargetFromMessageId(undefined)
                setTargetMode("normal")
            })

            flushSync(() => {
                setMessages([...messagesUpToEdit, updatedEditedMessage])
            })
            void regenerate({
                messageId,
                body: {
                    targetMode: "edit",
                    targetFromMessageId: messageId
                }
            })
        },
        [
            messages,
            setMessages,
            setTargetFromMessageId,
            setTargetMode,
            regenerate,
            deleteFileMutation,
            primeImmediateMessageUpdates
        ]
    )
    return {
        handleInputSubmit,
        handleRetry,
        handleEditAndRetry,
        handleBranch: useCallback(
            async (message: UIMessage) => {
                if (!threadId || composerStatus === "submitted") return
                if (message.role !== "assistant") return

                const messageIndex = messages.findIndex((m) => m.id === message.id)
                if (messageIndex === -1) return
                const branchMessages = messages.slice(0, messageIndex + 1)
                const branchTransitionKey = `branching:${threadId}`

                try {
                    setPendingBranchGeneration(branchTransitionKey, true)

                    const result = await branchThreadMutation({
                        threadId: threadId as Id<"threads">,
                        messageId: message.id
                    })

                    if (!result || "error" in result) {
                        toast.error(
                            typeof result?.error === "string"
                                ? result.error
                                : "Failed to branch chat"
                        )
                        return
                    }

                    captureBrowserEvent(TELEMETRY_EVENTS.conversationBranched, {
                        source_thread_id: threadId,
                        new_thread_id: String(result.threadId),
                        source_message_id: message.id,
                        source_message_index: messageIndex
                    })

                    flushSync(() => {
                        setTargetFromMessageId(undefined)
                        setTargetMode("normal")
                        setPendingBranchHydration({
                            threadId: result.threadId,
                            messages: branchMessages as ChatMessage[]
                        })
                    })

                    if (folderId) {
                        await navigate({
                            to: "/folder/$folderId/thread/$threadId",
                            params: { folderId, threadId: result.threadId }
                        })
                        return
                    }

                    await navigate({
                        to: "/thread/$threadId",
                        params: { threadId: result.threadId }
                    })
                } catch (error) {
                    console.error("Failed to branch chat:", error)
                    toast.error("Failed to branch chat")
                } finally {
                    setPendingBranchGeneration(branchTransitionKey, false)
                }
            },
            [
                branchThreadMutation,
                folderId,
                messages,
                navigate,
                setPendingBranchHydration,
                setPendingBranchGeneration,
                setTargetFromMessageId,
                setTargetMode,
                composerStatus,
                threadId
            ]
        )
    }
}
