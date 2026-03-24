import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { browserEnv } from "@/lib/browser-env"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import type { FileUIPart, UIMessage } from "ai"
import { useMutation } from "convex/react"
import { nanoid } from "nanoid"
import { useCallback } from "react"

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
    chat
}: {
    threadId: string | undefined
    folderId?: Id<"projects">
    chat: ChatActionHelpers<TMessage>
}) {
    const { uploadedFiles, setUploadedFiles, setTargetFromMessageId, setTargetMode } =
        useChatStore()
    const { status, sendMessage, stop, messages, setMessages, regenerate } = chat
    const deleteFileMutation = useMutation(api.attachments.deleteFile)

    const handleInputSubmit = useCallback(
        (inputValue?: string, fileValues?: UploadedFile[]) => {
            if (status === "streaming") {
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

            void sendMessage({
                id: nanoid(),
                role: "user",
                parts: [
                    ...finalFiles.map((file) => {
                        return {
                            type: "file",
                            url: `${browserEnv("VITE_CONVEX_API_URL")}/r2?key=${file.key}`,
                            mediaType: file.fileType,
                            filename: file.fileName
                        } satisfies FileUIPart
                    }),
                    ...(trimmedInput ? [{ type: "text" as const, text: trimmedInput }] : [])
                ]
            })

            setUploadedFiles([])
        },
        [sendMessage, stop, status, uploadedFiles, setUploadedFiles]
    )

    const handleRetry = useCallback(
        (message: UIMessage, modelIdOverride?: string) => {
            const messageIndex = messages.findIndex((m) => m.id === message.id)
            if (messageIndex === -1) return

            const messagesUpToRetry = messages.slice(0, messageIndex + 1)
            console.log("[CA:handleRetry]", {
                messages,
                messagesUpToRetry: messagesUpToRetry.length,
                messageIndex,
                messageId: message.id,
                modelIdOverride
            })
            setMessages(messagesUpToRetry)
            setTargetFromMessageId(undefined)
            setTargetMode("normal")
            void regenerate({
                messageId: message.id,
                body: {
                    targetMode: "retry",
                    targetFromMessageId: message.id,
                    ...(modelIdOverride ? { modelIdOverride } : {})
                }
            })
        },
        [messages, setMessages, setTargetFromMessageId, setTargetMode, regenerate]
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
                    try {
                        const parsed = new URL(url, browserEnv("VITE_CONVEX_API_URL"))
                        const key = parsed.searchParams.get("key")
                        if (key) {
                            deleteFileMutation({ key }).catch(console.error)
                        }
                    } catch {
                        // ignore
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

            console.log("alarm:handleEditAndRetry", {
                messagesUpToEdit: messagesUpToEdit.length,
                messageIndex,
                messageId
            })
            setMessages([...messagesUpToEdit, updatedEditedMessage])
            setTargetFromMessageId(undefined)
            setTargetMode("normal")
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
            deleteFileMutation
        ]
    )

    return {
        handleInputSubmit,
        handleRetry,
        handleEditAndRetry
    }
}
