import { api } from "@/convex/_generated/api"
import type { SharedModel } from "@/convex/lib/models"
import {
    type AssistantConfigOverride,
    getRetryTargetAssistantConfig,
    resolveAssistantConfigOverride
} from "@/lib/assistant-config"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import { useModelStore } from "@/lib/model-store"
import { extractR2KeyFromUrl, getPublicR2AssetUrl } from "@/lib/r2-public-url"
import type { FileUIPart, UIMessage } from "ai"
import { useMutation } from "convex/react"
import { nanoid } from "nanoid"
import { useCallback } from "react"
import { flushSync } from "react-dom"

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
    status: string
    sendMessage: (message: SendableUserMessage) => Promise<unknown>
    stop: () => void
    messages: TMessage[]
    setMessages: (messages: TMessage[] | ((messages: TMessage[]) => TMessage[])) => unknown
    regenerate: (options?: {
        messageId?: string
        body?: Record<string, unknown>
    }) => Promise<unknown>
}

export function useChatActions<TMessage extends UIMessage>({
    threadId,
    sharedModels,
    availableModels,
    fallbackModelId,
    chat
}: {
    threadId: string | undefined
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
        setLastLocalMutationAt
    } = useChatStore()
    const selectedModel = useModelStore((state) => state.selectedModel)
    const reasoningEffort = useModelStore((state) => state.reasoningEffort)
    const setSelectedModel = useModelStore((state) => state.setSelectedModel)
    const setReasoningEffort = useModelStore((state) => state.setReasoningEffort)
    const { status, sendMessage, stop, messages, setMessages, regenerate } = chat
    const deleteFileMutation = useMutation(api.attachments.deleteFile)

    const primeImmediateMessageUpdates = useCallback(() => {
        if (!threadId) {
            return
        }

        flushSync(() => {
            setPendingStream(threadId, true)
            setManuallyStoppedThread(threadId, false)
            setLastLocalMutationAt(Date.now())
        })
    }, [setManuallyStoppedThread, setPendingStream, setLastLocalMutationAt, threadId])

    const handleInputSubmit = useCallback(
        (inputValue?: string, fileValues?: UploadedFile[]) => {
            if (status === "streaming") {
                if (threadId) {
                    setPendingStream(threadId, false)
                    setManuallyStoppedThread(threadId, true)
                }
                stop()
                return
            }

            if (status === "submitted") {
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
            status,
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
            const persistedAssistantConfig = getRetryTargetAssistantConfig(messages, message.id)
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
        handleEditAndRetry
    }
}
