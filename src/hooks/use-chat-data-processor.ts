import { getCanonicalChatRouteTarget } from "@/lib/canonical-chat-route"
import { useChatStore } from "@/lib/chat-store"
import { suppressNextChatTransitionForPath } from "@/lib/chat-transition-override"
import { useNavigate } from "@tanstack/react-router"
import type { UIMessage } from "ai"
import { useEffect } from "react"

interface UseChatDataProcessorProps {
    messages: UIMessage<{
        threadId?: string
        streamId?: string
    }>[]
    status: "submitted" | "streaming" | "ready" | "error" | string
    clientId?: string
    folderId?: string
}

export function useChatDataProcessor({
    messages,
    status,
    clientId,
    folderId
}: UseChatDataProcessorProps) {
    const {
        setThreadId,
        setShouldUpdateQuery,
        setAttachedStreamId,
        threadId,
        setPendingStream,
        shouldUpdateQuery,
        attachedStreamIds,
        pendingStreams,
        pendingStreamOwnerClientIds
    } = useChatStore()
    const navigate = useNavigate()

    useEffect(() => {
        const latestMessage = messages[messages.length - 1]
        const latestAssistant = [...messages]
            .reverse()
            .find((message) => message.role === "assistant")
        if (!latestAssistant?.metadata) return

        if (latestAssistant.metadata.threadId) {
            if (threadId !== latestAssistant.metadata.threadId) {
                setThreadId(latestAssistant.metadata.threadId)
            }
            const canonicalRouteTarget =
                typeof window === "undefined"
                    ? null
                    : getCanonicalChatRouteTarget({
                          pathname: window.location.pathname,
                          threadId: latestAssistant.metadata.threadId,
                          folderId
                      })

            if (status !== "submitted" && status !== "streaming" && canonicalRouteTarget) {
                suppressNextChatTransitionForPath(canonicalRouteTarget.pathname)
                void navigate({
                    to: canonicalRouteTarget.to,
                    params: canonicalRouteTarget.params,
                    replace: true
                })
            }
            if (!shouldUpdateQuery) {
                setShouldUpdateQuery(true)
            }
        }

        if (threadId) {
            const currentKnownStreams = attachedStreamIds[threadId] || []
            const newStreamsFound: string[] = []

            for (const message of messages) {
                if (message.role === "assistant" && message.metadata?.streamId) {
                    const streamId = message.metadata.streamId as string
                    if (
                        !currentKnownStreams.includes(streamId) &&
                        !newStreamsFound.includes(streamId)
                    ) {
                        newStreamsFound.push(streamId)
                    }
                }
            }

            if (newStreamsFound.length > 0) {
                newStreamsFound.forEach((streamId) => {
                    setAttachedStreamId(threadId, streamId)
                })
            }

            if (
                status === "streaming" &&
                latestMessage?.id === latestAssistant.id &&
                latestAssistant.metadata.streamId
            ) {
                const effectiveThreadId = latestAssistant.metadata.threadId ?? threadId
                if (effectiveThreadId) {
                    const currentStreams = attachedStreamIds[effectiveThreadId] || []
                    const latestStreamId = latestAssistant.metadata.streamId as string
                    // Only clear pendingStream if this streamId was not in the existing attached array
                    // (Meaning it's a completely new chunk/stream from the backend)
                    if (!currentStreams.includes(latestStreamId)) {
                        const isLocalPendingOwner =
                            !clientId ||
                            !pendingStreamOwnerClientIds[effectiveThreadId] ||
                            pendingStreamOwnerClientIds[effectiveThreadId] === clientId

                        if (isLocalPendingOwner && pendingStreams[effectiveThreadId] !== false) {
                            setPendingStream(effectiveThreadId, false)
                        }
                    }
                }
            }
        }
    }, [
        messages,
        setThreadId,
        setShouldUpdateQuery,
        setAttachedStreamId,
        threadId,
        setPendingStream,
        shouldUpdateQuery,
        attachedStreamIds,
        pendingStreams,
        pendingStreamOwnerClientIds,
        status,
        navigate,
        clientId,
        folderId
    ])
}
