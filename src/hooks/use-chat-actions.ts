import { api } from "@/convex/_generated/api"
import type { SharedModel } from "@/convex/lib/models"
import {
    type AssistantConfigOverride,
    getRetryTargetAssistantConfig,
    resolveAssistantConfigOverride
} from "@/lib/assistant-config"
import { type ChatMessage, type UploadedFile, useChatStore } from "@/lib/chat-store"
import { useModelStore } from "@/lib/model-store"
import { extractR2KeyFromUrl, getPublicR2AssetUrl } from "@/lib/r2-public-url"
import { useNavigate } from "@tanstack/react-router"
import type { FileUIPart, UIMessage } from "ai"
import { useMutation } from "convex/react"
import { nanoid } from "nanoid"
import { useCallback } from "react"
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
    const navigate = useNavigate()

    const primeImmediateMessageUpdates = useCallback(() => {
        if (!threadId) {
            return
        }

        flushSync(() => {
            setPendingStream(threadId, true, chat.clientId)
            setManuallyStoppedThread(threadId, false)
            setLastLocalMutationAt(Date.now())
        })
    }, [
        chat.clientId,
        setManuallyStoppedThread,
        setPendingStream,
        setLastLocalMutationAt,
        threadId
    ])

    const handleInputSubmit = useCallback(
        (inputValue?: string, fileValues?: UploadedFile[]) => {
            if (composerStatus === "streaming") {
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
                            url: getPublicR2AssetUrl(file.key),
                            mediaType: file.fileType,
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

            const messagesUpToRetry = messages.slice(0, messageIndex + 1)
            const persistedAssistantConfig = getRetryTargetAssistantConfig(
                messages as Parameters<typeof getRetryTargetAssistantConfig>[0],
                message.id
            )
            const resolvedRetryConfig = resolveAssistantConfigOverride({
                config: {
                    modelId: configOverride?.modelIdOverride ?? persistedAssistantConfig?.modelId,
                    reasoningEffort:
                        configOverride?.reasoningEffortOverride ??
                        persistedAssistantConfig?.reasoningEffort
                },
                sharedModels,
                availableModels,
                fallbackModelId
            })

            primeImmediateMessageUpdates()
            flushSync(() => {
                setTargetFromMessageId(undefined)
                setTargetMode("normal")
            })
            flushSync(() => {
                setMessages(messagesUpToRetry)
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
            void regenerate({
                messageId: message.id,
                body: {
                    targetMode: "retry",
                    targetFromMessageId: message.id,
                    ...resolvedRetryConfig
                }
            })
        },
        [
            availableModels,
            fallbackModelId,
            messages,
            reasoningEffort,
            setMessages,
            setReasoningEffort,
            setSelectedModel,
            setTargetFromMessageId,
            setTargetMode,
            sharedModels,
            selectedModel,
            regenerate,
            primeImmediateMessageUpdates
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

            if (deletedUrls && deletedUrls.length > 0) {
                deletedUrls.forEach((url) => {
                    const key = extractR2KeyFromUrl(url)
                    if (key) {
                        deleteFileMutation({ key }).catch(console.error)
                    }
                })
            }

            // Truncate messages and update the edited message
            const messagesUpToEdit = messages.slice(0, messageIndex)
            const updatedEditedMessage = {
                ...messages[messageIndex],
                content: newContent,
                parts: [...(remainingFileParts || []), { type: "text" as const, text: newContent }]
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
                        threadId,
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
