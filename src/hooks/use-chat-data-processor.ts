import { useChatStore } from "@/lib/chat-store"
import { useNavigate } from "@tanstack/react-router"
import type { UIMessage } from "ai"
import { useEffect, useRef } from "react"

interface UseChatDataProcessorProps {
    messages: UIMessage<{
        threadId?: string
        streamId?: string
    }>[]
    status: "submitted" | "streaming" | "ready" | "error" | string
}

export function useChatDataProcessor({ messages, status }: UseChatDataProcessorProps) {
    const { setThreadId, setShouldUpdateQuery, setAttachedStreamId, threadId, setPendingStream } =
        useChatStore()
    const navigate = useNavigate()
    const previousStatusRef = useRef<string | undefined>(undefined)

    useEffect(() => {
        const previousStatus = previousStatusRef.current
        previousStatusRef.current = status

        const latestAssistant = [...messages]
            .reverse()
            .find((message) => message.role === "assistant")
        if (!latestAssistant?.metadata) return

        const isGenerating = status === "submitted" || status === "streaming"
        const generationJustFinished =
            (previousStatus === "submitted" || previousStatus === "streaming") && !isGenerating
        const shouldApplyAssistantMetadata = isGenerating || generationJustFinished

        if (!shouldApplyAssistantMetadata) return

        if (latestAssistant.metadata.threadId) {
            setThreadId(latestAssistant.metadata.threadId)
            if (
                generationJustFinished &&
                typeof window !== "undefined" &&
                window.location.pathname !== `/thread/${latestAssistant.metadata.threadId}`
            ) {
                void navigate({
                    to: "/thread/$threadId",
                    params: { threadId: latestAssistant.metadata.threadId },
                    replace: true
                })
            }
            setShouldUpdateQuery(true)
        }

        if (latestAssistant.metadata.streamId) {
            const effectiveThreadId = latestAssistant.metadata.threadId ?? threadId
            if (effectiveThreadId) {
                setAttachedStreamId(effectiveThreadId, latestAssistant.metadata.streamId)
                setPendingStream(effectiveThreadId, false)
            }
        }
    }, [
        messages,
        setThreadId,
        setShouldUpdateQuery,
        setAttachedStreamId,
        threadId,
        setPendingStream,
        status,
        navigate
    ])
}
