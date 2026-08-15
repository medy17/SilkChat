import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { backendToUiMessages } from "@/convex/lib/backend_to_ui_messages"
import type { SharedThread, Thread } from "@/convex/schema"
import { useToken } from "@/hooks/auth-hooks"
import { useAutoResume } from "@/hooks/use-auto-resume"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { type ChatMessage, useChatStore } from "@/lib/chat-store"
import { createChatTransportFetch } from "@/lib/chat-transport-fetch"
import { getActiveDevContextOverride } from "@/lib/dev-overrides"
import { decodeInlineDocumentDataUrl } from "@/lib/document-context"
import { type ReasoningEffort, useModelStore } from "@/lib/model-store"
import { resolvePublicFileUrl } from "@/lib/r2-public-url"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useQuery as useConvexQuery } from "convex-helpers/react/cache"
import { useConvexAuth } from "convex/react"
import type { Infer } from "convex/values"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useMemo, useRef } from "react"

type BackendMessagePart =
    | { type: "text"; text: string }
    | { type: "file"; data: string; filename?: string; mimeType?: string }

const normalizeAttachmentData = (url: string) => {
    if (url.startsWith("data:")) return url

    return resolvePublicFileUrl(url)
}

const normalizeUserMessageParts = (
    parts: UIMessage["parts"] | undefined
): BackendMessagePart[] | undefined => {
    if (!parts) return undefined

    return parts.reduce<BackendMessagePart[]>((normalizedParts, part) => {
        if (part.type === "text") {
            normalizedParts.push({ type: "text", text: part.text })
            return normalizedParts
        }

        if (part.type === "file") {
            const inlineDocument = decodeInlineDocumentDataUrl(part.url)
            if (inlineDocument) {
                normalizedParts.push({ type: "text", text: inlineDocument })
                return normalizedParts
            }

            normalizedParts.push({
                type: "file",
                data: normalizeAttachmentData(part.url),
                filename: part.filename,
                mimeType: part.mediaType
            })
        }

        return normalizedParts
    }, [])
}

const getMessageContentScore = (message: UIMessage | undefined) => {
    if (!message?.parts?.length) return 0

    return message.parts.reduce((score, part) => {
        switch (part.type) {
            case "text":
                return score + part.text.length
            case "reasoning":
                return score + part.text.length
            case "file":
                return score + 500
            case "dynamic-tool":
                return score + 250
            default:
                return part.type.startsWith("tool-") ? score + 250 : score
        }
    }, 0)
}

const getPartFingerprint = (part: UIMessage["parts"][number]) => {
    switch (part.type) {
        case "text":
            return `text:${part.text}`
        case "reasoning":
            return `reasoning:${part.text}`
        case "file":
            return `file:${part.mediaType ?? ""}:${part.filename ?? ""}:${part.url}`
        case "dynamic-tool":
            return `dynamic-tool:${part.toolName}:${JSON.stringify("input" in part ? part.input : null)}:${JSON.stringify("output" in part ? part.output : null)}`
        default:
            if (part.type.startsWith("tool-")) {
                return `${part.type}:${JSON.stringify("input" in part ? part.input : null)}:${JSON.stringify("output" in part ? part.output : null)}:${"state" in part ? part.state : ""}`
            }
            return part.type
    }
}

const getMessagesIdentityFingerprint = (messages: UIMessage[]) =>
    messages.map((message) => `${message.role}:${message.id}`).join("|")

const getMessagesContentFingerprint = (messages: UIMessage[]) =>
    messages
        .map(
            (message) =>
                `${message.role}:${message.id}:${message.parts?.map(getPartFingerprint).join("~") ?? ""}`
        )
        .join("|")

type CompletedLocalMessage = {
    id: string
    contentFingerprint: string
}

const getCompletedLocalMessage = (message: UIMessage): CompletedLocalMessage => ({
    id: message.id,
    contentFingerprint: getMessagesContentFingerprint([message])
})

const messageMatchesCompletedLocalMessage = (
    message: UIMessage | undefined,
    completedMessage: CompletedLocalMessage
) =>
    Boolean(
        message &&
            message.id === completedMessage.id &&
            getMessagesContentFingerprint([message]) === completedMessage.contentFingerprint
    )

const FOOTER_METADATA_KEYS = [
    "modelId",
    "modelName",
    "displayProvider",
    "runtimeProvider",
    "creditProviderSource",
    "reasoningEffort",
    "promptTokens",
    "completionTokens",
    "reasoningTokens",
    "totalTokens",
    "estimatedCostUsd",
    "estimatedPromptCostUsd",
    "estimatedCompletionCostUsd",
    "serverDurationMs",
    "timeToFirstVisibleMs",
    "contextRouting"
] as const

const getMetadataValue = (
    message: UIMessage | undefined,
    key: (typeof FOOTER_METADATA_KEYS)[number]
) => {
    if (!message || !("metadata" in message) || !message.metadata) {
        return undefined
    }

    return (message.metadata as Record<string, unknown>)[key]
}

const serializeMetadataValue = (value: unknown) => {
    if (value === undefined || value === null) {
        return ""
    }

    try {
        return JSON.stringify(value) ?? ""
    } catch {
        return String(value)
    }
}

const getMessageFooterMetadataFingerprint = (message: UIMessage | undefined) =>
    FOOTER_METADATA_KEYS.map((key) => serializeMetadataValue(getMetadataValue(message, key))).join(
        "|"
    )

const getMessageFooterMetadataScore = (message: UIMessage | undefined) =>
    FOOTER_METADATA_KEYS.reduce(
        (score, key) => (getMetadataValue(message, key) !== undefined ? score + 1 : score),
        0
    )

const getLatestAssistantMessage = (messages: UIMessage[]) =>
    [...messages].reverse().find((message) => message.role === "assistant")

const shouldAdoptBackendMessages = ({
    currentMessages,
    backendMessages,
    status,
    hasLocalActiveStream
}: {
    currentMessages: UIMessage[]
    backendMessages: UIMessage[]
    status?: string
    hasLocalActiveStream?: boolean
}) => {
    if (backendMessages.length === 0) return false
    if (currentMessages.length === 0) return true

    const currentIdentity = getMessagesIdentityFingerprint(currentMessages)
    const backendIdentity = getMessagesIdentityFingerprint(backendMessages)
    const isLocallyMutating =
        hasLocalActiveStream === true ||
        (hasLocalActiveStream !== false && (status === "streaming" || status === "submitted"))

    if (currentIdentity !== backendIdentity) {
        return !isLocallyMutating
    }

    const currentContent = getMessagesContentFingerprint(currentMessages)
    const backendContent = getMessagesContentFingerprint(backendMessages)

    if (currentContent === backendContent) {
        const currentAssistant = getLatestAssistantMessage(currentMessages)
        const backendAssistant = getLatestAssistantMessage(backendMessages)
        const currentMetadataScore = getMessageFooterMetadataScore(currentAssistant)
        const backendMetadataScore = getMessageFooterMetadataScore(backendAssistant)

        if (backendMetadataScore > currentMetadataScore) {
            return true
        }

        if (
            backendMetadataScore === currentMetadataScore &&
            backendMetadataScore > 0 &&
            getMessageFooterMetadataFingerprint(backendAssistant) !==
                getMessageFooterMetadataFingerprint(currentAssistant)
        ) {
            return true
        }

        return false
    }

    const currentAssistant = getLatestAssistantMessage(currentMessages)
    const backendAssistant = getLatestAssistantMessage(backendMessages)
    const currentAssistantScore = getMessageContentScore(currentAssistant)
    const backendAssistantScore = getMessageContentScore(backendAssistant)

    if (isLocallyMutating) {
        return currentAssistantScore === 0 && backendAssistantScore > 0
    }

    if (backendAssistantScore > currentAssistantScore) {
        return true
    }

    return true
}

const hasMeaningfulAssistantContent = (messages: UIMessage[]) =>
    getMessageContentScore(getLatestAssistantMessage(messages)) > 0

export function useChatIntegration<IsShared extends boolean>({
    threadId,
    sharedThreadId,
    isShared,
    folderId
}: {
    threadId: string | undefined
    sharedThreadId?: string | undefined
    isShared?: IsShared
    folderId?: Id<"projects">
}) {
    const auth = useConvexAuth()
    const { token } = useToken()
    const clientIdRef = useRef<string | undefined>(undefined)
    if (!clientIdRef.current) {
        clientIdRef.current = nanoid()
    }
    const clientId = clientIdRef.current
    // Whether the current useChat activity is our own send or a passive resume
    // of another client's stream. Lets the sender count as "local" without
    // depending on the thread subscription having caught up.
    const streamOriginRef = useRef<"send" | "resume" | null>(null)
    const { rerenderTrigger, shouldUpdateQuery, setShouldUpdateQuery, triggerRerender } =
        useChatStore()
    const pendingBranchHydration = useChatStore((state) => state.pendingBranchHydration)
    const hasPendingLocalStream = useChatStore((state) =>
        threadId && state.pendingStreams[threadId] === true
            ? !state.pendingStreamOwnerClientIds[threadId] ||
              state.pendingStreamOwnerClientIds[threadId] === clientId
            : false
    )
    const seededNextId = useRef<string | null>(null)
    const hydratedThreadIdRef = useRef<string | undefined>(undefined)
    const hydratedSharedSnapshotRef = useRef<string | undefined>(undefined)
    const previousThreadIdRef = useRef<string | undefined>(threadId)
    // The SDK receives its finish event before the final Convex message snapshot is
    // guaranteed to reach this client's resumed subscription. Keep that completed
    // message authoritative until Convex has published the same content once.
    const completedLocalMessageRef = useRef<CompletedLocalMessage | null>(null)
    const latestRequestContextRef = useRef({
        folderId,
        threadId,
        token
    })
    latestRequestContextRef.current = {
        folderId,
        threadId,
        token
    }

    // For regular threads, use getThreadMessages
    const threadMessages = useConvexQuery(
        api.threads.getThreadMessages,
        !isShared && threadId && !auth.isLoading && !hasPendingLocalStream
            ? { threadId: threadId as Id<"threads"> }
            : "skip"
    )

    // For shared threads, get the shared thread data
    const sharedThread = useConvexQuery(
        api.threads.getSharedThread,
        isShared && sharedThreadId
            ? { sharedThreadId: sharedThreadId as Id<"sharedThreads"> }
            : "skip"
    )

    const thread = useConvexQuery(
        api.threads.getThread,
        !isShared && threadId && !auth.isLoading ? { threadId: threadId as Id<"threads"> } : "skip"
    )

    const initialMessages = useMemo<ChatMessage[]>(() => {
        if (
            !isShared &&
            threadId &&
            pendingBranchHydration?.threadId === threadId &&
            pendingBranchHydration.messages.length > 0
        ) {
            return pendingBranchHydration.messages as ChatMessage[]
        }

        if (isShared) {
            if (!sharedThread?.messages) return []
            return backendToUiMessages(sharedThread.messages)
        }

        if (!threadMessages || "error" in threadMessages) return []
        return backendToUiMessages(threadMessages)
    }, [threadMessages, sharedThread, isShared, pendingBranchHydration, threadId])
    const chatHelpers = useChat({
        id: isShared ? `shared_${sharedThreadId}` : rerenderTrigger,
        // Bound React work during high-frequency streams. The message renderer separately stays
        // in streaming mode until the server clears isLive, so a trailing throttled update cannot
        // be mistaken for a completed static replacement.
        throttle: 50,
        transport: isShared
            ? undefined
            : new DefaultChatTransport<ChatMessage>({
                  api: `${browserEnv("VITE_CONVEX_API_URL")}/chat`,
                  fetch: createChatTransportFetch(),
                  async prepareSendMessagesRequest({ body, messages }) {
                      const currentContext = latestRequestContextRef.current
                      const { selectedModel, enabledTools, reasoningEffort } =
                          useModelStore.getState()
                      const { selectedPersona, pendingPersonaOpening } = useChatStore.getState()
                      const jwt = await resolveJwtToken(currentContext.token)
                      if (!jwt) {
                          throw new Error("Authentication token unavailable")
                      }

                      if (currentContext.threadId) {
                          useChatStore
                              .getState()
                              .setManuallyStoppedThread(currentContext.threadId, false)
                          useChatStore
                              .getState()
                              .setPendingStream(currentContext.threadId, true, clientId)
                      }

                      const proposedNewAssistantId = nanoid()
                      seededNextId.current = proposedNewAssistantId
                      streamOriginRef.current = "send"
                      completedLocalMessageRef.current = null

                      const message = messages[messages.length - 1]
                      const requestBody = body as Record<string, unknown> & {
                          modelIdOverride?: string
                          reasoningEffortOverride?: ReasoningEffort
                      }

                      return {
                          headers: {
                              authorization: `Bearer ${jwt}`
                          },
                          body: {
                              ...requestBody,
                              id: currentContext.threadId,
                              proposedNewAssistantId,
                              model: requestBody.modelIdOverride ?? selectedModel,
                              message: {
                                  parts: normalizeUserMessageParts(message?.parts),
                                  role: message?.role,
                                  messageId: message?.id
                              },
                              enabledTools,
                              folderId: currentContext.folderId,
                              reasoningEffort:
                                  requestBody.reasoningEffortOverride ?? reasoningEffort,
                              clientId,
                              personaSelection: currentContext.threadId
                                  ? undefined
                                  : selectedPersona,
                              personaOpening:
                                  !currentContext.threadId &&
                                  selectedPersona.source !== "default" &&
                                  pendingPersonaOpening?.source === selectedPersona.source &&
                                  pendingPersonaOpening.personaId === selectedPersona.id
                                      ? {
                                            openingId: pendingPersonaOpening.openingId,
                                            messageId: pendingPersonaOpening.messageId
                                        }
                                      : undefined,
                              devContextOverride: getActiveDevContextOverride()
                          }
                      }
                  },
                  async prepareReconnectToStreamRequest({ api, id }) {
                      const currentContext = latestRequestContextRef.current
                      const jwt = await resolveJwtToken(currentContext.token)
                      if (!jwt) {
                          throw new Error("Authentication token unavailable")
                      }

                      const reconnectThreadId = currentContext.threadId ?? id

                      return {
                          api: `${api}?chatId=${encodeURIComponent(reconnectThreadId)}`,
                          headers: {
                              authorization: `Bearer ${jwt}`
                          }
                      }
                  }
              }),
        messages: initialMessages,
        onFinish: ({ message, isError }) => {
            completedLocalMessageRef.current = isError ? null : getCompletedLocalMessage(message)
            const currentThreadId = latestRequestContextRef.current.threadId
            if (currentThreadId) {
                useChatStore.getState().setPendingStream(currentThreadId, false)
            }
            streamOriginRef.current = null
            if (!isShared && shouldUpdateQuery) {
                setShouldUpdateQuery(false)
            }
        },
        onError: () => {
            completedLocalMessageRef.current = null
            const currentThreadId = latestRequestContextRef.current.threadId
            if (currentThreadId) {
                useChatStore.getState().setPendingStream(currentThreadId, false)
            }
            streamOriginRef.current = null
        },
        generateId: () => {
            if (seededNextId.current) {
                const id = seededNextId.current
                seededNextId.current = null
                return id
            }
            return nanoid()
        }
    })
    const hasActiveThreadStream =
        chatHelpers.status === "streaming" ||
        chatHelpers.status === "submitted" ||
        hasPendingLocalStream ||
        (thread && "isLive" in thread && thread.isLive === true && Boolean(thread.currentStreamId))
    const hasServerActiveThreadStream = Boolean(
        thread && "isLive" in thread && thread.isLive === true && thread.currentStreamId
    )
    const serverStreamOwnerClientId =
        thread && "currentStreamOwnerClientId" in thread
            ? thread.currentStreamOwnerClientId
            : undefined
    const isCurrentClientServerStreamOwner = Boolean(
        hasServerActiveThreadStream &&
            serverStreamOwnerClientId &&
            clientId &&
            serverStreamOwnerClientId === clientId
    )
    const hasUnownedServerStream = hasServerActiveThreadStream && !serverStreamOwnerClientId
    const isCurrentClientStreamStatusLocal =
        !threadId ||
        streamOriginRef.current === "send" ||
        isCurrentClientServerStreamOwner ||
        hasUnownedServerStream
    const hasLocalActiveStream =
        hasPendingLocalStream ||
        isCurrentClientServerStreamOwner ||
        ((chatHelpers.status === "submitted" || chatHelpers.status === "streaming") &&
            isCurrentClientStreamStatusLocal)
    // A live stream owned elsewhere still surfaces as "streaming" so the
    // composer offers stop (which stops it server-side) instead of a send the
    // thread's live-lock would reject.
    const composerStatus =
        chatHelpers.status === "submitted" || chatHelpers.status === "streaming"
            ? hasLocalActiveStream
                ? chatHelpers.status
                : hasServerActiveThreadStream
                  ? "streaming"
                  : "ready"
            : hasServerActiveThreadStream && !hasLocalActiveStream
              ? "streaming"
              : chatHelpers.status
    const latestAssistantMessage = getLatestAssistantMessage(chatHelpers.messages)
    const streamActivityKey = useMemo(
        () =>
            latestAssistantMessage ? getMessagesContentFingerprint([latestAssistantMessage]) : "",
        [latestAssistantMessage]
    )

    useEffect(() => {
        const previousThreadId = previousThreadIdRef.current
        previousThreadIdRef.current = threadId
        const adoptedThreadCreatedByCurrentSend =
            previousThreadId === undefined &&
            threadId !== undefined &&
            streamOriginRef.current === "send"

        if (adoptedThreadCreatedByCurrentSend) return

        streamOriginRef.current = null
        completedLocalMessageRef.current = null
    }, [threadId])

    useEffect(() => {
        if (!isShared) {
            hydratedSharedSnapshotRef.current = undefined
            return
        }

        if (!sharedThreadId || !sharedThread?.messages) return

        const snapshotKey = `${sharedThreadId}:${getMessagesContentFingerprint(initialMessages)}`
        if (hydratedSharedSnapshotRef.current === snapshotKey) return

        hydratedSharedSnapshotRef.current = snapshotKey
        chatHelpers.setMessages(initialMessages)
    }, [isShared, sharedThreadId, sharedThread, initialMessages, chatHelpers.setMessages])

    useEffect(() => {
        if (isShared) return

        if (!threadId) {
            hydratedThreadIdRef.current = undefined
            return
        }

        if (!threadMessages || "error" in threadMessages) return

        if (hydratedThreadIdRef.current !== threadId) {
            hydratedThreadIdRef.current = threadId

            if (!hasActiveThreadStream) {
                chatHelpers.setMessages(initialMessages)
                return
            }

            if (hasPendingLocalStream) {
                return
            }

            if (!hasMeaningfulAssistantContent(chatHelpers.messages)) {
                chatHelpers.setMessages(initialMessages)
            }
        }
    }, [
        isShared,
        threadId,
        threadMessages,
        initialMessages,
        chatHelpers.messages,
        hasActiveThreadStream,
        hasPendingLocalStream,
        chatHelpers.setMessages
    ])

    useEffect(() => {
        if (isShared) return
        if (!threadId) return
        if (!threadMessages || "error" in threadMessages) return
        if (hasPendingLocalStream) return

        const completedLocalMessage = completedLocalMessageRef.current
        if (completedLocalMessage) {
            const currentCompletedMessage = chatHelpers.messages.find(
                (message) => message.id === completedLocalMessage.id
            )
            const backendCompletedMessage = initialMessages.find(
                (message) => message.id === completedLocalMessage.id
            )

            if (
                messageMatchesCompletedLocalMessage(backendCompletedMessage, completedLocalMessage)
            ) {
                completedLocalMessageRef.current = null
            } else if (
                messageMatchesCompletedLocalMessage(currentCompletedMessage, completedLocalMessage)
            ) {
                return
            } else {
                completedLocalMessageRef.current = null
            }
        }

        if (
            shouldAdoptBackendMessages({
                currentMessages: chatHelpers.messages,
                backendMessages: initialMessages,
                status: chatHelpers.status,
                hasLocalActiveStream
            })
        ) {
            chatHelpers.setMessages(initialMessages)
        }
    }, [
        isShared,
        threadId,
        threadMessages,
        initialMessages,
        chatHelpers.messages,
        chatHelpers.status,
        hasLocalActiveStream,
        hasPendingLocalStream,
        chatHelpers.setMessages
    ])

    useEffect(() => {
        if (isShared) return
        if (hasLocalActiveStream) return
        if (chatHelpers.status !== "streaming") return
        if (hasServerActiveThreadStream) return

        chatHelpers.stop()
    }, [
        isShared,
        hasLocalActiveStream,
        hasServerActiveThreadStream,
        chatHelpers.status,
        chatHelpers.stop
    ])

    const customResume = useCallback(() => {
        const effectiveMessages =
            chatHelpers.messages.length === 0 && initialMessages.length > 0
                ? initialMessages
                : chatHelpers.messages
        const hasLiveStream = Boolean(
            thread && "isLive" in thread && thread.isLive === true && thread.currentStreamId
        )

        console.log("[UCI:custom_resume]", {
            threadId: threadId?.slice(0, 8),
            backendMsgs: threadMessages && !("error" in threadMessages) ? threadMessages.length : 0,
            currentUIMsgs: chatHelpers.messages.length,
            initialMsgs: initialMessages.length,
            hasPersistedAssistantContent: hasMeaningfulAssistantContent(effectiveMessages),
            hasLiveStream
        })

        if (chatHelpers.messages.length === 0 && initialMessages.length > 0) {
            chatHelpers.setMessages(initialMessages)
            console.log("[UCI:messages_restored]", { count: initialMessages.length })
        }

        if (!hasLiveStream && hasMeaningfulAssistantContent(effectiveMessages)) {
            return
        }

        streamOriginRef.current = "resume"
        return chatHelpers.resumeStream()
    }, [
        chatHelpers.setMessages,
        chatHelpers.resumeStream,
        chatHelpers.messages,
        initialMessages,
        thread,
        threadMessages,
        threadId
    ])

    const stopRemoteStream = useCallback(() => {
        if (isShared) return
        const currentThreadId = latestRequestContextRef.current.threadId
        if (!currentThreadId) return

        void (async () => {
            try {
                const jwt = await resolveJwtToken(latestRequestContextRef.current.token)
                if (!jwt) return
                await fetch(
                    `${browserEnv("VITE_CONVEX_API_URL")}/chat?chatId=${encodeURIComponent(currentThreadId)}`,
                    {
                        method: "DELETE",
                        headers: {
                            authorization: `Bearer ${jwt}`
                        }
                    }
                )
            } catch (error) {
                console.warn("[UCI:stop_remote] Failed to stop backend stream", error)
            }
        })()
    }, [isShared])

    useAutoResume({
        autoResume: !isShared, // Skip auto resume for shared threads
        thread: thread || undefined,
        threadId,
        experimental_resume: customResume,
        status: chatHelpers.status,
        threadMessages,
        clientId,
        streamActivityKey,
        localChatId: chatHelpers.id,
        restartLocalChat: triggerRerender,
        hasDirectSendStream:
            streamOriginRef.current === "send" &&
            (chatHelpers.status === "submitted" || chatHelpers.status === "streaming")
    })

    return {
        ...chatHelpers,
        composerStatus,
        stopRemoteStream,
        clientId,
        seededNextId,
        thread: (thread || sharedThread) as unknown as IsShared extends true
            ? Infer<typeof SharedThread>
            : Infer<typeof Thread>
    }
}
