import type { Id } from "@/convex/_generated/dataModel"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import type { FileUIPart, UIMessage } from "ai"
import { nanoid } from "nanoid"
import { useCallback } from "react"

interface ChatActionHelpers {
    status: string
    sendMessage: (message: any) => Promise<unknown>
    stop: () => void
    messages: UIMessage[]
    setMessages: (messages: any) => unknown
    regenerate: (options?: {
        messageId?: string
        body?: Record<string, unknown>
    }) => Promise<unknown>
}

export function useChatActions({
    chat
}: {
    threadId: string | undefined
    folderId?: Id<"projects">
    chat: ChatActionHelpers
}) {
    const { uploadedFiles, setUploadedFiles, setTargetFromMessageId, setTargetMode } =
        useChatStore()
    const { status, sendMessage, stop, messages, setMessages, regenerate } = chat

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
                            url: `${window.location.origin}/r2?key=${file.key}`,
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
        (message: UIMessage) => {
            const messageIndex = messages.findIndex((m) => m.id === message.id)
            if (messageIndex === -1) return

            const messagesUpToRetry = messages.slice(0, messageIndex + 1)
            console.log("[CA:handleRetry]", {
                messages,
                messagesUpToRetry: messagesUpToRetry.length,
                messageIndex,
                messageId: message.id
            })
            setMessages(messagesUpToRetry)
            setTargetFromMessageId(undefined)
            setTargetMode("normal")
            void regenerate({
                messageId: message.id,
                body: {
                    targetMode: "retry",
                    targetFromMessageId: message.id
                }
            })
        },
        [messages, setMessages, regenerate]
    )

    const handleEditAndRetry = useCallback(
        (messageId: string, newContent: string) => {
            const messageIndex = messages.findIndex((m) => m.id === messageId)
            if (messageIndex === -1) return

            // Truncate messages and update the edited message
            const messagesUpToEdit = messages.slice(0, messageIndex)
            const updatedEditedMessage = {
                ...messages[messageIndex],
                content: newContent,
                parts: [{ type: "text" as const, text: newContent }]
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
        [messages, setMessages, setTargetFromMessageId, regenerate]
    )

    return {
        handleInputSubmit,
        handleRetry,
        handleEditAndRetry
    }
}
