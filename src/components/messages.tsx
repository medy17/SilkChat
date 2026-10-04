import { getRetryTargetAssistantConfig, type GenerationConfig } from "@/lib/assistant-config"
import { EditableMessage } from "./composer/message-editor"
import type { useChatIntegration } from "@/hooks/use-chat-integration"
import { useMessageRenderFingerprints } from "@/hooks/use-message-render-fingerprints"
import { MessageEditContent } from "@/components/message-edit-content"
import type { AssistantConfigOverride } from "@/lib/assistant-config"
import {
    hasPdfAttachmentInMessages,
    hasVisionImageAttachmentInMessages
} from "@/lib/attachment-support"
import { isLargePasteMediaType } from "@/lib/attachment-tile"
import { getToolFailureAttempt, getToolFailureAttempts } from "@/lib/blocked-tool-attempt"
import { useChatStore } from "@/lib/chat-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import { getFileTypeInfo } from "@/lib/file_constants"
import { playResponseCompleteHaptic, playResponseStartHaptic } from "@/lib/haptics"
import { getMessageCodeExecutions } from "@/lib/message-code-executions"
import type { AssistantMessageMetadata } from "@/lib/message-footer-stats"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import { getVirtualizedMessageCount, shouldVirtualizeMessageList } from "@/lib/message-list-mode"
import { getMessageReasoningDetails } from "@/lib/message-reasoning"
import {
    getMessageFooterMetadataKey,
    getMessageRenderFingerprint
} from "@/lib/message-render-fingerprint"
import { getMessageWebSearches, getMessageImageSearches } from "@/lib/message-web-searches"
import { formatQuotedSelection } from "@/lib/quote-selection"
import { resolvePublicFileUrl } from "@/lib/r2-public-url"
import { isTabularTextFile } from "@/lib/tabular-file-preview"
import { cn, downloadUrl } from "@/lib/utils"
import type { FileUIPart, Tool, UIMessage, UIToolInvocation } from "ai"
import {
    Code,
    Download,
    FileText,
    FileType,
    FileType2,
    Image as ImageIcon,
    Quote,
    X
} from "lucide-react"
import {
    type MouseEvent as ReactMouseEvent,
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { toast } from "sonner"
import { Virtualizer, type VirtualizerHandle } from "virtua"
import { AttachmentTile } from "./attachment-tile"
import { ChatActions } from "./chat-actions"
import { ChatErrorNotice } from "./chat-error-notice"
import { VisualSelectionContext } from "./visual-references"
import type { VisualSelection } from "@/lib/visual-selections"
import { MemoizedMarkdown } from "./memoized-markdown"
import { MESSAGE_MARKDOWN_CLASS, USER_MESSAGE_BUBBLE_CLASS } from "./message-presentation"
import { RoleplayPortraitAssignmentRenderer } from "./renderers/roleplay-portrait-assignment"
import { SkillLoaderRenderer } from "./renderers/skill-loader"
import { PdfFilePreview } from "./pdf-file-preview"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning"
import { BlockedToolCard } from "./renderers/blocked-tool-card"
import { CodeExecutionGroupRenderer } from "./renderers/code-execution-group"
import { GenericToolRenderer } from "./renderers/generic-tool"
import { ImageGenerationToolRenderer } from "./renderers/image-generation-ui"
import { MemoryRetrievalToolRenderer } from "./renderers/memory-retrieval-tool"
import { MemoryToolRenderer } from "./renderers/memory-tool"
import { NativeChartToolRenderer } from "./renderers/native-chart-tool"
import { NativeNetworkToolRenderer } from "./renderers/native-network-tool"
import { PersistentSandboxCard } from "./renderers/persistent-sandbox-card"
import { WebSearchGroupRenderer } from "./renderers/web-search-ui"
import { TabularFilePreview } from "./tabular-file-preview"
import { Button } from "./ui/button"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Loader } from "./ui/loader"

const extractFileName = (url: string) => {
    if (url.startsWith("data:")) return "Inline file"

    const match = url.match(/[?&]key=([^&]+)/)
    const key = match?.[1] ? decodeURIComponent(match[1]) : url
    const extracted = key.startsWith("attachments/")
        ? (key.split("/").pop() ?? "")
        : (key.split("/").pop() ?? "")
    return extracted.length > 51 ? extracted.slice(51) : extracted
}

const getFileIcon = (part: { url: string; filename?: string; mediaType?: string }) => {
    if (isLargePasteMediaType(part.mediaType)) {
        return <FileText className="size-4 text-primary" />
    }

    const resolvedFileName = part.filename || extractFileName(part.url)
    const { isImage, isCode, isPdf } = getFileTypeInfo(resolvedFileName, part.mediaType)

    if (isImage) return <ImageIcon className="size-4 text-blue-500" />
    if (isCode) return <Code className="size-4 text-green-500" />
    if (isPdf) return <FileType2 className="size-4 text-gray-500" />
    return <FileType className="size-4 text-gray-500" />
}

const hasVisibleAssistantContent = (message: UIMessage | undefined) => {
    if (message?.role !== "assistant" || !message.parts?.length) {
        return false
    }

    const reasoning = getMessageReasoningDetails(message)

    return message.parts.some((part) => {
        switch (part.type) {
            case "text":
                return part.text.trim() !== ""
            case "reasoning":
                return Boolean(reasoning)
            case "file":
            case "dynamic-tool":
                return true
            default:
                return part.type.startsWith("tool-")
        }
    })
}

export const shouldShowTypingLoader = ({
    messages,
    status
}: {
    messages: UIMessage[]
    status: string
}) => {
    const lastMessage = messages[messages.length - 1]

    if (lastMessage?.role !== "assistant") {
        return status === "submitted"
    }

    if (status !== "submitted" && status !== "streaming") {
        return false
    }

    return !hasVisibleAssistantContent(lastMessage)
}

const FileAttachment = memo(
    ({
        part,
        onPreview
    }: {
        part: { url: string; filename?: string; mediaType?: string }
        onPreview?: () => void
    }) => {
        const extractedFileName = extractFileName(part.url)
        const fileName = part.filename || extractedFileName
        const { isImage } = getFileTypeInfo(fileName, part.mediaType)
        const isLargePaste = isLargePasteMediaType(part.mediaType)
        const [imageError, setImageError] = useState(false)

        const handleInteraction = () => {
            if (onPreview) {
                onPreview()
            }
        }

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleInteraction()
            }
        }

        const handleImageError = () => {
            setImageError(true)
        }

        if (isImage) {
            if (imageError) {
                return (
                    <div className="group relative flex w-full max-w-md items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-8 transition-colors">
                        <div className="text-center">
                            <ImageIcon className="mx-auto mb-2 h-12 w-12 text-destructive/70" />
                            <p className="font-medium text-destructive text-sm">
                                Image unavailable
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                File may have been deleted
                            </p>
                            {fileName !== "Unknown file" && (
                                <p className="mt-1 text-muted-foreground text-xs">{fileName}</p>
                            )}
                        </div>
                    </div>
                )
            }

            return (
                <img
                    src={resolvePublicFileUrl(part.url)}
                    alt={fileName}
                    className="w-full max-w-md cursor-pointer rounded-lg object-contain transition-opacity hover:opacity-90"
                    onClick={handleInteraction}
                    onKeyDown={handleKeyDown}
                    onError={handleImageError}
                    tabIndex={onPreview ? 0 : -1}
                    role={onPreview ? "button" : undefined}
                />
            )
        }

        return (
            <AttachmentTile
                fileName={fileName}
                kind={isLargePaste ? "large-paste" : "attachment"}
                icon={getFileIcon(part)}
                onClick={onPreview ? handleInteraction : undefined}
            />
        )
    }
)
FileAttachment.displayName = "FileAttachment"

// Compact, single-row attachment tile used when a message carries more than one
// file. Mirrors the edit composer's collapsed previews so a multi-image message
// doesn't balloon the bubble height (and appear to "vanish" above the fold).
const CompactAttachment = memo(
    ({
        part,
        onPreview
    }: {
        part: { url: string; filename?: string; mediaType?: string }
        onPreview?: () => void
    }) => {
        const fileName = part.filename || extractFileName(part.url)
        const { isImage } = getFileTypeInfo(fileName, part.mediaType)
        const isLargePaste = isLargePasteMediaType(part.mediaType)
        const [imageError, setImageError] = useState(false)

        const showImage = isImage && !imageError

        if (!showImage) {
            return (
                <AttachmentTile
                    fileName={fileName}
                    kind={isLargePaste ? "large-paste" : "attachment"}
                    detail={isImage ? "Unavailable" : undefined}
                    icon={
                        isImage ? (
                            <ImageIcon className="size-4 text-muted-foreground" />
                        ) : (
                            getFileIcon(part)
                        )
                    }
                    onClick={() => onPreview?.()}
                    className="h-12"
                />
            )
        }

        return (
            <button
                type="button"
                onClick={() => onPreview?.()}
                title={fileName}
                className={cn(
                    "group relative flex h-12 shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-secondary/50 transition-all hover:bg-secondary/80",
                    showImage ? "w-12 p-0" : "min-w-12 max-w-52 px-3"
                )}
                style={{ borderRadius: "var(--radius)" }}
            >
                {showImage ? (
                    <img
                        src={resolvePublicFileUrl(part.url)}
                        alt={fileName}
                        className="h-full w-full object-cover"
                        style={{ borderRadius: "calc(var(--radius) - 2px)" }}
                        onError={() => setImageError(true)}
                    />
                ) : null}
            </button>
        )
    }
)
CompactAttachment.displayName = "CompactAttachment"

const PartsRenderer = memo(
    ({
        part,
        markdown,
        id,
        threadId,
        sharedThreadId,
        messageId,
        onFilePreview,
        onSwitchModel,
        onRetryError,
        isStreaming,
        readOnly = false
    }: {
        part: UIMessage["parts"][number]
        markdown: boolean
        id: string
        threadId?: string
        sharedThreadId?: string
        messageId: string
        onFilePreview?: (part: { url: string; filename?: string; mediaType?: string }) => void
        onSwitchModel?: (modelId: string) => void
        onRetryError?: () => void
        isStreaming?: boolean
        readOnly?: boolean
    }) => {
        switch (part.type) {
            case "data-context-error": {
                const errorPart = part as {
                    data: {
                        code: string
                        message: string
                        detail?: unknown
                    }
                }
                return (
                    <div className="not-prose my-3">
                        <ChatErrorNotice
                            error={
                                new Error(
                                    JSON.stringify({
                                        code: errorPart.data.code,
                                        message: errorPart.data.message,
                                        detail: errorPart.data.detail
                                    })
                                )
                            }
                            onSwitchModel={onSwitchModel}
                            onRetry={onRetryError}
                        />
                    </div>
                )
            }
            case "text":
                return markdown ? (
                    <MemoizedMarkdown content={part.text} isAnimating={isStreaming} />
                ) : (
                    <div>
                        {part.text.split("\n").map((line, index) => (
                            <div key={index}>{line}</div>
                        ))}
                    </div>
                )
            case "reasoning": {
                const hasReasoningContent = part.text && part.text.trim() !== ""
                const isReasoningStreaming = isStreaming && part.state !== "done"

                return (
                    <Reasoning className="mb-6" isStreaming={isReasoningStreaming}>
                        <ReasoningTrigger className="mb-4">Reasoning</ReasoningTrigger>
                        <ReasoningContent
                            markdown={markdown}
                            isAnimating={isReasoningStreaming}
                            className="rounded-lg border bg-muted/50"
                            contentClassName={REASONING_MARKDOWN_CLASS}
                        >
                            {hasReasoningContent ? part.text : ""}
                        </ReasoningContent>
                    </Reasoning>
                )
            }
            case "tool-request_persistent_sandbox":
                return (
                    <PersistentSandboxCard
                        toolInvocation={part as UIToolInvocation<Tool>}
                        threadId={threadId}
                        messageId={messageId}
                    />
                )
            case "tool-load_skill":
                return <SkillLoaderRenderer toolInvocation={part as UIToolInvocation<Tool>} />
            case "tool-assign_roleplay_portrait":
                return (
                    <RoleplayPortraitAssignmentRenderer
                        toolInvocation={part as UIToolInvocation<Tool>}
                    />
                )
            case "tool-search_memories":
                return <MemoryRetrievalToolRenderer toolInvocation={part} mode="search" />
            case "tool-get_memory_profile":
                return <MemoryRetrievalToolRenderer toolInvocation={part} mode="profile" />
            case "tool-image_generation":
                return <ImageGenerationToolRenderer toolInvocation={part} readOnly={readOnly} />
            case "tool-render_chart":
                return <NativeChartToolRenderer toolInvocation={part} />
            case "tool-render_network":
                return <NativeNetworkToolRenderer toolInvocation={part} />
            case "tool-prepareImageGeneration":
                return (
                    <ImageGenerationToolRenderer
                        toolInvocation={part}
                        threadId={threadId}
                        sharedThreadId={sharedThreadId}
                        messageId={messageId}
                        readOnly={readOnly}
                    />
                )
            case "tool-add_memory":
            case "tool-update_memory":
            case "tool-forget_memory":
                return (
                    <MemoryToolRenderer
                        toolInvocation={part}
                        threadId={threadId}
                        messageId={messageId}
                    />
                )
            case "dynamic-tool":
                return (
                    <GenericToolRenderer
                        toolInvocation={part as UIToolInvocation<Tool>}
                        toolName={part.toolName}
                    />
                )
            case "file":
                return <FileAttachment part={part} onPreview={() => onFilePreview?.(part)} />
        }
    }
)
PartsRenderer.displayName = "PartsRenderer"

const MESSAGE_EDIT_ANIMATION_OPTIONS = {
    duration: 240,
    easing: "cubic-bezier(0, 0, 0.58, 1)"
}

const MESSAGE_VIRTUALIZER_BUFFER = 700
const MESSAGE_VIRTUALIZER_ITEM_SIZE = 208
const BOTTOM_SCROLL_THRESHOLD_PX = 4
const SCROLL_IDLE_DELAY_MS = 2_000
const ACCORDION_SCROLL_FOLLOW_PAUSE_MS = 200
const STREAMING_ANCHOR_TOP_GAP_PX = 16
// Keep loading and the first response content the same height, allowing longer
// replies to grow naturally once they exceed the reserved space.
const RESPONSE_SPACE_CLASS = "min-h-[min(24rem,50dvh)]"
const REASONING_MARKDOWN_CLASS =
    "prose max-w-none prose-pre:bg-transparent p-4 prose-pre:p-0 [font-weight:450] prose-headings:font-semibold prose-strong:font-medium prose-pre:text-foreground leading-7 [&_.ignore-pre-bg>div]:bg-transparent [&_pre>div]:border-0.5 [&_pre>div]:border-border [&_pre>div]:bg-background"
const QUOTE_TOOLTIP_SIZE_PX = 32
const QUOTE_TOOLTIP_MARGIN_PX = 8
const QUOTE_TOOLTIP_GAP_PX = 12

type PreviewFile = {
    url: string
    filename?: string
    mediaType?: string
}

type QuoteSelectionState = {
    selection: string
    x: number
    y: number
    placement: "above" | "below"
}

const getMessagePartKey = (messageId: string, part: UIMessage["parts"][number], index: number) => {
    if ("toolCallId" in part && typeof part.toolCallId === "string" && part.toolCallId.length > 0) {
        return `${messageId}-tool-${part.toolCallId}`
    }

    return `${messageId}-${part.type}-${index}`
}

type MessageRowProps = {
    message: UIMessage
    initialConfig?: ReturnType<typeof getRetryTargetAssistantConfig>
    renderFingerprint: string
    liveRenderFingerprint?: string
    footerMetadataKey?: string
    isStreamingMessage: boolean
    isEditing: boolean
    isFirstMessage: boolean
    hasActiveTarget: boolean
    retryMessage?: UIMessage
    onRetry?: (message: UIMessage, configOverride?: AssistantConfigOverride) => void
    onSwitchModel?: (modelId: string) => void
    onBranch?: (message: UIMessage) => void
    onEdit?: (message: UIMessage) => void
    onSaveEdit: (
        newContent: string,
        remainingFileParts?: FileUIPart[],
        deletedUrls?: string[],
        config?: GenerationConfig
    ) => Promise<boolean>
    onCancelEdit: () => void
    onFilePreview: (part: PreviewFile) => void
    requiresVisionForModelSelection: boolean
    requiresNativePdfForModelSelection: boolean
    threadId?: string
    folderId?: string
    sharedThreadId?: string
    copyOnlyActions?: boolean
}

const MessageRowComponent = ({
    message,
    initialConfig,
    isStreamingMessage,
    isEditing,
    isFirstMessage,
    hasActiveTarget,
    retryMessage,
    onRetry,
    onSwitchModel,
    onBranch,
    onEdit,
    onSaveEdit,
    onCancelEdit,
    onFilePreview,
    requiresVisionForModelSelection,
    requiresNativePdfForModelSelection,
    threadId,
    folderId,
    sharedThreadId,
    copyOnlyActions
}: MessageRowProps) => {
    const hapticStreamActiveRef = useRef(false)
    const responseStartHapticPlayedRef = useRef(false)
    const reasoning = getMessageReasoningDetails(message)
    const executions = getMessageCodeExecutions(message)
    const codeExecutions = executions.filter((execution) => execution.kind === "code")
    const mathExecutions = executions.filter((execution) => execution.kind === "math")
    const webSearches = getMessageWebSearches(message)
    const imageSearches = getMessageImageSearches(message)
    const toolFailureAttempts = getToolFailureAttempts(message)
    const hasResponseText = message.parts.some(
        (part) => part.type === "text" && part.text.trim() !== ""
    )

    useEffect(() => {
        if (message.role !== "assistant") return

        if (isStreamingMessage) {
            hapticStreamActiveRef.current = true
            if (hasResponseText && !responseStartHapticPlayedRef.current) {
                responseStartHapticPlayedRef.current = true
                playResponseStartHaptic()
            }
            return
        }

        if (hapticStreamActiveRef.current) {
            hapticStreamActiveRef.current = false
            if (responseStartHapticPlayedRef.current) {
                responseStartHapticPlayedRef.current = false
                playResponseCompleteHaptic()
            }
        }
    }, [hasResponseText, isStreamingMessage, message.role])

    const groupedToolOrder = [
        ...message.parts.flatMap((part, firstPartIndex) =>
            part.type === "tool-load_skill"
                ? [{ type: "skill-load" as const, firstPartIndex, part }]
                : []
        ),
        ...(toolFailureAttempts.length > 0
            ? [
                  {
                      type: "blocked-tools" as const,
                      firstPartIndex: message.parts.findIndex((part) =>
                          Boolean(getToolFailureAttempt(part))
                      )
                  }
              ]
            : []),
        ...(codeExecutions.length > 0
            ? [
                  {
                      type: "code-execution" as const,
                      firstPartIndex: message.parts.findIndex(
                          (part) => part.type === "tool-execute_code"
                      )
                  }
              ]
            : []),
        ...(mathExecutions.length > 0
            ? [
                  {
                      type: "math-kit" as const,
                      firstPartIndex: message.parts.findIndex(
                          (part) => part.type === "tool-execute_math"
                      )
                  }
              ]
            : []),
        ...(imageSearches.length > 0
            ? [
                  {
                      type: "image-search" as const,
                      firstPartIndex: message.parts.findIndex(
                          (part) => part.type === "tool-image_search"
                      )
                  }
              ]
            : []),
        ...(webSearches.length > 0
            ? [
                  {
                      type: "web-search" as const,
                      firstPartIndex: message.parts.findIndex(
                          (part) => part.type === "tool-web_search"
                      )
                  }
              ]
            : [])
    ].sort((left, right) => left.firstPartIndex - right.firstPartIndex)
    const inlineParts = message.parts.filter((part) => {
        if (getToolFailureAttempt(part)) return false
        return (
            part.type !== "file" &&
            part.type !== "reasoning" &&
            part.type !== "tool-execute_code" &&
            part.type !== "tool-execute_math" &&
            part.type !== "tool-web_search" &&
            part.type !== "tool-image_search" &&
            part.type !== "tool-load_skill"
        )
    })
    const fileParts = message.parts.filter((part) => part.type === "file")
    const cancelEditRequestRef = useRef<(() => void) | null>(null)
    const bubbleRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const contentAnimationRef = useRef<Animation | null>(null)
    const contentViewportAnimationRef = useRef<Animation | null>(null)
    const bubbleAnimationRef = useRef<Animation | null>(null)
    const controlsAnimationRef = useRef<Animation | null>(null)
    const bubbleRectRef = useRef<{ width: number; height: number } | null>(null)
    const prevIsEditingRef = useRef(isEditing)

    const captureCurrentBubbleLayout = useCallback(() => {
        const element = bubbleRef.current
        if (!element) return

        const rect = element.getBoundingClientRect()

        bubbleRectRef.current = { width: rect.width, height: rect.height }
        // Reserve the current space before React swaps rendered markdown for
        // raw text (or vice versa). A snapshot alone cannot prevent scroll clamping.
        element.style.height = `${rect.height}px`
    }, [])

    const handleStartEdit = useCallback(
        (selectedMessage: UIMessage) => {
            // The credit summary request used to cause a post-mount rerender that
            // refreshed these coordinates by accident. Capture them at the actual
            // interaction boundary so the first edit is independent of fetch timing.
            captureCurrentBubbleLayout()
            onEdit?.(selectedMessage)
        },
        [captureCurrentBubbleLayout, onEdit]
    )

    const handleSaveEdit = useCallback(
        (
            newContent: string,
            remainingFileParts?: FileUIPart[],
            deletedUrls?: string[],
            config?: GenerationConfig
        ) => {
            captureCurrentBubbleLayout()
            return onSaveEdit(newContent, remainingFileParts, deletedUrls, config)
        },
        [captureCurrentBubbleLayout, onSaveEdit]
    )

    const handleCancelEdit = useCallback(() => {
        captureCurrentBubbleLayout()
        onCancelEdit()
    }, [captureCurrentBubbleLayout, onCancelEdit])

    // Measure the complete destination before starting any child animations.
    // Animate the shell, holding content at its final width so markdown/math
    // does not reflow at every intermediate shell width.
    useLayoutEffect(() => {
        if (message.role !== "user") return

        const element = bubbleRef.current
        if (!element) return

        const editingChanged = prevIsEditingRef.current !== isEditing
        if (!editingChanged) return

        contentAnimationRef.current?.cancel()
        contentViewportAnimationRef.current?.cancel()
        bubbleAnimationRef.current?.cancel()
        controlsAnimationRef.current?.cancel()
        const rect = element.getBoundingClientRect()
        const content = contentRef.current
        const contentRect = content?.getBoundingClientRect()
        const contentWidth = contentRect?.width
        const controls = element.querySelector<HTMLElement>("[data-edit-controls]")
        const controlsHeight = controls?.getBoundingClientRect().height
        const nextWidth = rect.width
        // The shell still holds its previous height. Measure natural content at
        // the destination width without briefly collapsing the document.
        const shellStyle = getComputedStyle(element)
        const nextHeight = contentRect
            ? contentRect.height +
              parseFloat(shellStyle.paddingTop) +
              parseFloat(shellStyle.paddingBottom) +
              parseFloat(shellStyle.borderTopWidth) +
              parseFloat(shellStyle.borderBottomWidth)
            : rect.height
        const prevRect = bubbleRectRef.current

        bubbleRectRef.current = { width: nextWidth, height: nextHeight }
        prevIsEditingRef.current = isEditing

        if (prevRect === null) {
            element.style.removeProperty("height")
            return
        }

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            element.style.removeProperty("height")
            return
        }

        const animationOptions = MESSAGE_EDIT_ANIMATION_OPTIONS

        if (content && contentWidth !== undefined) {
            // Clip against the changing shell, while the content keeps its final
            // width so markdown does not reflow on every animation frame.
            contentViewportAnimationRef.current = content.parentElement!.animate(
                [
                    { maxHeight: "100%", overflow: "hidden" },
                    { maxHeight: "100%", overflow: "hidden" }
                ],
                animationOptions
            )
            contentAnimationRef.current = content.animate(
                [
                    {
                        width: `${contentWidth}px`
                    },
                    { width: `${contentWidth}px` }
                ],
                animationOptions
            )
        }
        bubbleAnimationRef.current = element.animate(
            [
                {
                    width: `${prevRect.width}px`,
                    height: `${prevRect.height}px`,
                    maxWidth: "none"
                },
                {
                    width: `${nextWidth}px`,
                    height: `${nextHeight}px`,
                    maxWidth: "none"
                }
            ],
            animationOptions
        )
        const bubbleAnimation = bubbleAnimationRef.current
        void bubbleAnimation.finished
            .then(() => {
                if (bubbleAnimationRef.current !== bubbleAnimation) return
                element.style.removeProperty("height")
                bubbleAnimationRef.current = null
            })
            .catch(() => undefined)
        if (controls && controlsHeight !== undefined) {
            controlsAnimationRef.current = controls.animate(
                [
                    { height: "0px", overflow: "hidden" },
                    { height: `${controlsHeight}px`, overflow: "hidden" }
                ],
                animationOptions
            )
        }
    })

    useLayoutEffect(() => {
        return () => {
            contentAnimationRef.current?.cancel()
            contentViewportAnimationRef.current?.cancel()
            bubbleAnimationRef.current?.cancel()
            controlsAnimationRef.current?.cancel()
        }
    }, [])

    useEffect(() => {
        if (!isEditing) return
        let cancelled = false
        const focusEditor = () => {
            if (cancelled) return
            const textarea = contentRef.current?.querySelector("textarea")
            if (!textarea) return
            textarea.focus()
            textarea.setSelectionRange(textarea.value.length, textarea.value.length)
        }
        // Let native focus scrolling reveal the editor, then repeat once its
        // shell has settled. Exiting does not reposition the page.
        const timer = setTimeout(focusEditor, 0)
        void bubbleAnimationRef.current?.finished.then(focusEditor).catch(() => undefined)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [isEditing])

    const visualMetadata = message.metadata as
        | { visualSelections?: VisualSelection[]; visualStatus?: string }
        | undefined
    const visualSelections = visualMetadata?.visualSelections
    const visualStatus = visualMetadata?.visualStatus
    const visualContext = useMemo(
        () => ({
            selections: visualSelections ?? [],
            pending: isStreamingMessage || visualStatus === "pending",
            legacy:
                !copyOnlyActions &&
                message.role === "assistant" &&
                threadId &&
                !isStreamingMessage &&
                !visualStatus
                    ? { threadId, messageId: message.id }
                    : undefined
        }),
        [
            visualSelections,
            visualStatus,
            isStreamingMessage,
            copyOnlyActions,
            message.role,
            message.id,
            threadId
        ]
    )

    return (
        <div className="pb-3" data-message-id={message.id} data-message-role={message.role}>
            <div
                ref={bubbleRef}
                className={cn(
                    MESSAGE_MARKDOWN_CLASS,
                    "group prose-img:mx-auto prose-img:my-4 prose-pre:grid prose-code:before:hidden prose-code:after:hidden",
                    "mb-8",
                    // User bubbles bring their own top margin; an assistant message
                    // opening the thread (persona speaks first) needs the same gap
                    // below the header.
                    message.role === "assistant" && isFirstMessage && "mt-12",
                    message.role === "user" && !isEditing && USER_MESSAGE_BUBBLE_CLASS,
                    message.role === "user" &&
                        isEditing &&
                        "my-12 ml-auto w-full border-2 border-input bg-background/80 p-3 shadow-xs dark:bg-input/70"
                )}
                style={isEditing ? { borderRadius: "var(--radius-lg)" } : undefined}
            >
                <div>
                    <div
                        ref={contentRef}
                        className={message.role === "user" ? "flow-root" : undefined}
                    >
                        <VisualSelectionContext.Provider value={visualContext}>
                            <MessageEditContent
                                editing={isEditing}
                                editor={
                                    <EditableMessage
                                        message={message}
                                        threadId={threadId}
                                        folderId={folderId}
                                        initialConfig={initialConfig}
                                        onSave={handleSaveEdit}
                                        onCancel={handleCancelEdit}
                                        cancelRequestRef={cancelEditRequestRef}
                                        requiresNativePdfForModelSelection={
                                            requiresNativePdfForModelSelection
                                        }
                                    />
                                }
                            >
                                <div className="max-w-full overflow-hidden">
                                    {reasoning && (
                                        <Reasoning
                                            className="mb-6"
                                            isStreaming={
                                                isStreamingMessage && reasoning.isStreaming
                                            }
                                        >
                                            <ReasoningTrigger className="mb-4">
                                                Reasoning
                                            </ReasoningTrigger>
                                            <ReasoningContent
                                                markdown={message.role === "assistant"}
                                                isAnimating={
                                                    isStreamingMessage && reasoning.isStreaming
                                                }
                                                className="rounded-lg border bg-muted/50"
                                                contentClassName={REASONING_MARKDOWN_CLASS}
                                            >
                                                {reasoning.text}
                                            </ReasoningContent>
                                        </Reasoning>
                                    )}

                                    {groupedToolOrder.map((activity) =>
                                        activity.type === "skill-load" ? (
                                            <SkillLoaderRenderer
                                                key={getMessagePartKey(
                                                    message.id,
                                                    activity.part,
                                                    activity.firstPartIndex
                                                )}
                                                toolInvocation={
                                                    activity.part as UIToolInvocation<Tool>
                                                }
                                            />
                                        ) : activity.type === "blocked-tools" ? (
                                            <BlockedToolCard
                                                key={`${message.id}-blocked-tools`}
                                                attempts={toolFailureAttempts}
                                                retryMessage={retryMessage}
                                                onRetry={onRetry}
                                                requiresVision={requiresVisionForModelSelection}
                                                requiresNativePdf={
                                                    requiresNativePdfForModelSelection
                                                }
                                            />
                                        ) : activity.type === "code-execution" ? (
                                            <CodeExecutionGroupRenderer
                                                key={`${message.id}-code-executions`}
                                                executions={codeExecutions}
                                                kind="code"
                                            />
                                        ) : activity.type === "math-kit" ? (
                                            <CodeExecutionGroupRenderer
                                                key={`${message.id}-math-executions`}
                                                executions={mathExecutions}
                                                kind="math"
                                            />
                                        ) : (
                                            <WebSearchGroupRenderer
                                                key={`${message.id}-${activity.type}`}
                                                searches={
                                                    activity.type === "image-search"
                                                        ? imageSearches
                                                        : webSearches
                                                }
                                                kind={
                                                    activity.type === "image-search"
                                                        ? "image"
                                                        : "web"
                                                }
                                            />
                                        )
                                    )}

                                    {inlineParts.map((part, index) => (
                                        <PartsRenderer
                                            key={getMessagePartKey(message.id, part, index)}
                                            part={part}
                                            markdown={true}
                                            id={getMessagePartKey(message.id, part, index)}
                                            threadId={
                                                ((
                                                    message.metadata as
                                                        | { threadId?: string }
                                                        | undefined
                                                )?.threadId as string | undefined) ?? threadId
                                            }
                                            messageId={message.id}
                                            sharedThreadId={sharedThreadId}
                                            onFilePreview={onFilePreview}
                                            onSwitchModel={onSwitchModel}
                                            onRetryError={
                                                !copyOnlyActions && retryMessage && onRetry
                                                    ? () => onRetry(retryMessage)
                                                    : undefined
                                            }
                                            isStreaming={isStreamingMessage}
                                            readOnly={copyOnlyActions}
                                        />
                                    ))}
                                </div>

                                {fileParts.length > 1 ? (
                                    <div className="not-prose mt-3 flex flex-wrap justify-start gap-2">
                                        {fileParts.map((part, index) => (
                                            <CompactAttachment
                                                key={`${message.id}-file-${index}`}
                                                part={part as FileUIPart}
                                                onPreview={() => onFilePreview(part as FileUIPart)}
                                            />
                                        ))}
                                    </div>
                                ) : fileParts.length === 1 ? (
                                    <div className="not-prose mt-3 flex flex-col justify-start space-y-3">
                                        <PartsRenderer
                                            key={`${message.id}-file-0`}
                                            part={fileParts[0]}
                                            markdown={message.role === "assistant"}
                                            id={`${message.id}-file-0`}
                                            threadId={
                                                ((
                                                    message.metadata as
                                                        | { threadId?: string }
                                                        | undefined
                                                )?.threadId as string | undefined) ?? threadId
                                            }
                                            messageId={message.id}
                                            sharedThreadId={sharedThreadId}
                                            onFilePreview={onFilePreview}
                                            isStreaming={isStreamingMessage}
                                            readOnly={copyOnlyActions}
                                        />
                                    </div>
                                ) : null}
                            </MessageEditContent>
                        </VisualSelectionContext.Provider>
                    </div>
                </div>

                {message.role === "user" && (!hasActiveTarget || isEditing) ? (
                    <ChatActions
                        role={message.role}
                        message={message}
                        onRetry={onRetry}
                        onEdit={handleStartEdit}
                        editing={isEditing}
                        onCancelEdit={() => cancelEditRequestRef.current?.()}
                        requiresVisionForModelSelection={requiresVisionForModelSelection}
                        requiresNativePdfForModelSelection={requiresNativePdfForModelSelection}
                        copyOnly={copyOnlyActions}
                    />
                ) : !hasActiveTarget && message.role === "assistant" && !isStreamingMessage ? (
                    <ChatActions
                        role={message.role}
                        message={message}
                        onRetry={undefined}
                        threadId={threadId}
                        onBranch={onBranch}
                        onEdit={undefined}
                        copyOnly={copyOnlyActions}
                    />
                ) : null}
            </div>
        </div>
    )
}

const areMessageRowPropsEqual = (previousProps: MessageRowProps, nextProps: MessageRowProps) =>
    previousProps.message.id === nextProps.message.id &&
    previousProps.renderFingerprint === nextProps.renderFingerprint &&
    previousProps.liveRenderFingerprint === nextProps.liveRenderFingerprint &&
    previousProps.footerMetadataKey === nextProps.footerMetadataKey &&
    previousProps.isStreamingMessage === nextProps.isStreamingMessage &&
    previousProps.isEditing === nextProps.isEditing &&
    previousProps.isFirstMessage === nextProps.isFirstMessage &&
    previousProps.hasActiveTarget === nextProps.hasActiveTarget &&
    previousProps.retryMessage?.id === nextProps.retryMessage?.id &&
    previousProps.onRetry === nextProps.onRetry &&
    previousProps.onSwitchModel === nextProps.onSwitchModel &&
    previousProps.onBranch === nextProps.onBranch &&
    previousProps.onEdit === nextProps.onEdit &&
    previousProps.onSaveEdit === nextProps.onSaveEdit &&
    previousProps.onCancelEdit === nextProps.onCancelEdit &&
    previousProps.onFilePreview === nextProps.onFilePreview &&
    previousProps.requiresVisionForModelSelection === nextProps.requiresVisionForModelSelection &&
    previousProps.requiresNativePdfForModelSelection ===
        nextProps.requiresNativePdfForModelSelection &&
    previousProps.sharedThreadId === nextProps.sharedThreadId &&
    previousProps.threadId === nextProps.threadId &&
    previousProps.folderId === nextProps.folderId &&
    previousProps.copyOnlyActions === nextProps.copyOnlyActions

const MessageRow = memo(MessageRowComponent, areMessageRowPropsEqual)
MessageRow.displayName = "MessageRow"

export type MessagesHandle = {
    scrollToBottom: (behavior?: ScrollBehavior) => void
}

export type MessageScrollDirection = "up" | "down" | "idle"

export const Messages = forwardRef<
    MessagesHandle,
    {
        messages: UIMessage[]
        onRetry?: (message: UIMessage, configOverride?: AssistantConfigOverride) => void
        onBranch?: (message: UIMessage) => void
        onEditAndRetry?: (
            messageId: string,
            newContent: string,
            remainingFileParts?: FileUIPart[],
            deletedUrls?: string[],
            config?: GenerationConfig
        ) => Promise<boolean>
        onQuoteSelection?: (selection: string) => void
        status: ReturnType<typeof useChatIntegration>["status"]
        error?: ReturnType<typeof useChatIntegration>["error"]
        onBottomStateChange?: (isAtBottom: boolean) => void
        onScrollDirectionChange?: (direction: MessageScrollDirection) => void
        threadKey?: string
        threadId?: string
        folderId?: string
        sharedThreadId?: string
        copyOnlyActions?: boolean
    }
>(
    (
        {
            messages,
            onRetry,
            onBranch,
            onEditAndRetry,
            onQuoteSelection,
            status,
            error,
            onBottomStateChange,
            onScrollDirectionChange,
            threadKey,
            threadId,
            folderId,
            sharedThreadId,
            copyOnlyActions = false
        },
        ref
    ) => {
        const { setTargetFromMessageId, targetFromMessageId, setTargetMode, targetMode } =
            useChatStore()
        const { chatWidthState } = useChatWidthStore()
        const scrollerRef = useRef<HTMLDivElement>(null)
        const contentContainerRef = useRef<HTMLDivElement>(null)
        const virtualizerRef = useRef<VirtualizerHandle>(null)
        const virtualizedMessageCount = getVirtualizedMessageCount(messages.length)
        const shouldVirtualize = shouldVirtualizeMessageList(messages.length)
        const isAtBottomRef = useRef(true)
        const lastScrollOffsetRef = useRef<number | null>(null)
        const scrollDirectionRef = useRef<MessageScrollDirection>("idle")
        const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
        const shouldStickToBottomRef = useRef(true)
        const allowUnboundedStreamingFollowRef = useRef(false)
        const autoFollowPausedUntilRef = useRef(0)
        const onRetryRef = useRef(onRetry)
        const onBranchRef = useRef(onBranch)
        const onEditAndRetryRef = useRef(onEditAndRetry)
        onRetryRef.current = onRetry
        onBranchRef.current = onBranch
        onEditAndRetryRef.current = onEditAndRetry

        const stableOnRetry = useCallback(
            (message: UIMessage, configOverride?: AssistantConfigOverride) =>
                onRetryRef.current?.(message, configOverride),
            []
        )
        const stableOnBranch = useCallback(
            (message: UIMessage) => onBranchRef.current?.(message),
            []
        )

        const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
        const [previewDownloadPending, setPreviewDownloadPending] = useState(false)
        const [previewFile, setPreviewFile] = useState<{
            url: string
            filename?: string
            mediaType?: string
        } | null>(null)
        const [quoteSelection, setQuoteSelection] = useState<QuoteSelectionState | null>(null)

        const handleEdit = useCallback(
            (message: UIMessage) => {
                shouldStickToBottomRef.current = false
                setTargetFromMessageId(message.id)
                setTargetMode("edit")
            },
            [setTargetFromMessageId, setTargetMode]
        )

        const handleSaveEdit = useCallback(
            (
                newContent: string,
                remainingFileParts?: FileUIPart[],
                deletedUrls?: string[],
                config?: GenerationConfig
            ) => {
                if (targetFromMessageId && onEditAndRetryRef.current) {
                    return onEditAndRetryRef.current(
                        targetFromMessageId,
                        newContent,
                        remainingFileParts,
                        deletedUrls,
                        config
                    )
                }
                return Promise.resolve(false)
            },
            [targetFromMessageId]
        )

        const handleCancelEdit = useCallback(() => {
            shouldStickToBottomRef.current = false
            setTargetFromMessageId(undefined)
            setTargetMode("normal")
        }, [setTargetFromMessageId, setTargetMode])

        const handleFilePreview = useCallback((part: PreviewFile) => {
            setPreviewFile(part)
            setPreviewDialogOpen(true)
        }, [])
        const liveFingerprintMessageId = status === "streaming" ? messages.at(-1)?.id : undefined
        const editingFingerprintMessageId = targetMode === "edit" ? targetFromMessageId : undefined
        const renderFingerprints = useMessageRenderFingerprints(messages, {
            liveMessageId: liveFingerprintMessageId,
            editingMessageId: editingFingerprintMessageId
        })
        const threadHasPdfAttachments = useMemo(
            () => hasPdfAttachmentInMessages(messages),
            [messages]
        )
        const threadHasVisionImageAttachments = useMemo(
            () => hasVisionImageAttachmentInMessages(messages),
            [messages]
        )

        const fileName = previewFile?.filename || extractFileName(previewFile?.url || "")

        const handlePreviewDownload = useCallback(async () => {
            if (!previewFile || previewDownloadPending) return
            setPreviewDownloadPending(true)
            try {
                await downloadUrl({
                    url: resolvePublicFileUrl(previewFile.url),
                    fileName: fileName || "download"
                })
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Download failed")
            } finally {
                setPreviewDownloadPending(false)
            }
        }, [fileName, previewDownloadPending, previewFile])

        const renderFilePreview = () => {
            if (!previewFile) return null

            const resolvedPreviewUrl = resolvePublicFileUrl(previewFile.url)
            const { isImage, isText, isPdf } = getFileTypeInfo(fileName, previewFile.mediaType)
            const isTabular = isTabularTextFile(fileName, previewFile.mediaType)

            return (
                <div
                    className={cn(
                        "min-h-0 overflow-auto",
                        isImage && "flex items-center justify-center"
                    )}
                >
                    {isImage && (
                        <img
                            src={resolvedPreviewUrl}
                            alt={fileName}
                            className="h-auto max-h-[calc(90dvh-8rem)] w-auto max-w-full object-contain"
                            style={{ borderRadius: "var(--radius-sm)" }}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                const errorDiv = target.nextElementSibling as HTMLElement
                                if (errorDiv) errorDiv.style.display = "flex"
                            }}
                        />
                    )}

                    {isTabular && (
                        <TabularFilePreview
                            url={resolvedPreviewUrl}
                            filename={fileName}
                            mediaType={previewFile.mediaType}
                        />
                    )}

                    {isText && !isTabular && (
                        <iframe
                            src={resolvedPreviewUrl}
                            className="h-[69dvh] w-full rounded border-0"
                            title={fileName}
                        />
                    )}

                    {isPdf && <PdfFilePreview url={resolvedPreviewUrl} filename={fileName} />}

                    {!isImage && !isText && !isPdf && !isTabular && (
                        <div className="rounded-[var(--radius-md)] border bg-muted/40 p-4 text-sm">
                            <p className="font-medium">Preview unavailable</p>
                            <p className="mt-1 text-muted-foreground">
                                This file type cannot be previewed safely. Use Download to save it.
                            </p>
                        </div>
                    )}
                </div>
            )
        }

        const lastMessage = messages[messages.length - 1]
        const lastMessageFooterMetadataKey =
            lastMessage?.role === "assistant" ? getMessageFooterMetadataKey(lastMessage) : undefined
        const lastMessageReasoning = lastMessage ? getMessageReasoningDetails(lastMessage) : null
        const hasActiveTarget = !copyOnlyActions && Boolean(targetFromMessageId)
        const isStreamingWithoutContent =
            status === "streaming" &&
            lastMessage?.role === "assistant" &&
            (!lastMessage.parts ||
                lastMessage.parts.length === 0 ||
                lastMessage.parts.every(
                    (part) =>
                        (part.type === "text" && (!part.text || part.text.trim() === "")) ||
                        (part.type === "reasoning" && !lastMessageReasoning)
                ))

        const showTypingLoader =
            shouldShowTypingLoader({ messages, status }) || isStreamingWithoutContent

        const updateBottomState = useCallback(
            (nextIsAtBottom: boolean) => {
                if (isAtBottomRef.current === nextIsAtBottom) {
                    return
                }

                isAtBottomRef.current = nextIsAtBottom
                onBottomStateChange?.(nextIsAtBottom)
            },
            [onBottomStateChange]
        )

        const updateScrollDirection = useCallback(
            (direction: MessageScrollDirection) => {
                if (scrollDirectionRef.current === direction) {
                    return
                }

                scrollDirectionRef.current = direction
                onScrollDirectionChange?.(direction)
            },
            [onScrollDirectionChange]
        )

        const scheduleScrollIdle = useCallback(() => {
            if (scrollIdleTimerRef.current !== null) {
                clearTimeout(scrollIdleTimerRef.current)
            }

            scrollIdleTimerRef.current = setTimeout(() => {
                scrollIdleTimerRef.current = null
                updateScrollDirection("idle")
            }, SCROLL_IDLE_DELAY_MS)
        }, [updateScrollDirection])

        useEffect(
            () => () => {
                if (scrollIdleTimerRef.current !== null) {
                    clearTimeout(scrollIdleTimerRef.current)
                }
            },
            []
        )

        const getStreamingAnchorMaxScrollTop = useCallback(() => {
            const scroller = scrollerRef.current
            if (!scroller) return null

            const userMessages = contentContainerRef.current?.querySelectorAll<HTMLElement>(
                '[data-message-role="user"]'
            )
            const latestUserMessage = userMessages?.[userMessages.length - 1]
            if (!latestUserMessage) return null

            const scrollerRect = scroller.getBoundingClientRect()
            const userMessageRect = latestUserMessage.getBoundingClientRect()
            const userMessageBottom = scroller.scrollTop + userMessageRect.bottom - scrollerRect.top

            return Math.max(0, userMessageBottom - STREAMING_ANCHOR_TOP_GAP_PX)
        }, [])

        const syncBottomStateFromOffset = useCallback(
            (offset?: number) => {
                const scroller = scrollerRef.current
                if (!scroller) return

                const scrollOffset = offset ?? scroller.scrollTop
                const scrollSize = scroller.scrollHeight
                const viewportSize = scroller.clientHeight
                const distanceFromBottom = Math.max(0, scrollSize - viewportSize - scrollOffset)
                const isAtBottom = distanceFromBottom <= BOTTOM_SCROLL_THRESHOLD_PX

                if (status === "streaming" && !allowUnboundedStreamingFollowRef.current) {
                    const maximumFollowScrollTop = getStreamingAnchorMaxScrollTop()
                    if (
                        maximumFollowScrollTop !== null &&
                        scrollOffset > maximumFollowScrollTop + BOTTOM_SCROLL_THRESHOLD_PX
                    ) {
                        allowUnboundedStreamingFollowRef.current = true
                    }
                }

                shouldStickToBottomRef.current = isAtBottom
                updateBottomState(isAtBottom)
            },
            [getStreamingAnchorMaxScrollTop, status, updateBottomState]
        )

        const handleScroll = useCallback(
            (offset: number) => {
                syncBottomStateFromOffset(offset)
                scheduleScrollIdle()

                const previousOffset = lastScrollOffsetRef.current
                lastScrollOffsetRef.current = offset

                if (previousOffset === null || offset === previousOffset) {
                    return
                }

                updateScrollDirection(offset > previousOffset ? "down" : "up")
            },
            [scheduleScrollIdle, syncBottomStateFromOffset, updateScrollDirection]
        )

        const handleContentClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
            const target = event.target
            if (
                !(target instanceof Element) ||
                !target.closest("[data-pause-chat-scroll-follow]")
            ) {
                return
            }

            autoFollowPausedUntilRef.current = Date.now() + ACCORDION_SCROLL_FOLLOW_PAUSE_MS
        }, [])

        const scrollToBottom = useCallback(
            (behavior: ScrollBehavior = "auto") => {
                allowUnboundedStreamingFollowRef.current = true
                shouldStickToBottomRef.current = true
                updateBottomState(true)

                const scroller = scrollerRef.current
                if (!scroller) {
                    return
                }

                scroller.scrollTo({
                    top: scroller.scrollHeight,
                    behavior
                })
            },
            [updateBottomState]
        )

        const scrollToStreamingEdge = useCallback(() => {
            if (useChatStore.getState().targetMode === "edit") return
            const scroller = scrollerRef.current
            if (!scroller) return

            const bottomScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
            let targetScrollTop = bottomScrollTop

            if (status === "streaming" && !allowUnboundedStreamingFollowRef.current) {
                const maximumFollowScrollTop = getStreamingAnchorMaxScrollTop()
                if (maximumFollowScrollTop !== null) {
                    targetScrollTop = Math.min(bottomScrollTop, maximumFollowScrollTop)
                }
            }

            const reachedStreamingLimit = targetScrollTop < bottomScrollTop
            if (reachedStreamingLimit) {
                shouldStickToBottomRef.current = false
                updateBottomState(false)
            }

            scroller.scrollTo({ top: targetScrollTop, behavior: "auto" })
        }, [getStreamingAnchorMaxScrollTop, status, updateBottomState])

        useImperativeHandle(
            ref,
            () => ({
                scrollToBottom
            }),
            [scrollToBottom]
        )

        const lastUserMessage = useMemo(
            () => [...messages].reverse().find((message) => message.role === "user"),
            [messages]
        )

        useEffect(() => {
            void lastUserMessage?.id
            allowUnboundedStreamingFollowRef.current = false
        }, [lastUserMessage?.id])
        const handleSwitchModel = useMemo(
            () =>
                lastUserMessage
                    ? (modelId: string) =>
                          stableOnRetry(lastUserMessage, { modelIdOverride: modelId })
                    : undefined,
            [lastUserMessage, stableOnRetry]
        )
        const messageRows = useMemo(() => {
            let nearestUserMessage: UIMessage | undefined

            return messages.map((message, index) => {
                const isStreamingMessage = status === "streaming" && message.id === lastMessage?.id
                const isEditing =
                    !copyOnlyActions && targetFromMessageId === message.id && targetMode === "edit"
                const shouldUseLiveFingerprint = isStreamingMessage || isEditing

                const row = {
                    message,
                    retryMessage: message.role === "assistant" ? nearestUserMessage : undefined,
                    isFirstMessage: index === 0,
                    renderFingerprint:
                        renderFingerprints[message.id] ?? `${message.role}:${message.id}`,
                    liveRenderFingerprint: shouldUseLiveFingerprint
                        ? getMessageRenderFingerprint(message)
                        : undefined,
                    footerMetadataKey:
                        message.role === "assistant"
                            ? getMessageFooterMetadataKey(message)
                            : undefined,
                    isStreamingMessage,
                    isEditing,
                    hasActiveTarget
                }
                if (message.role === "user") nearestUserMessage = message
                return row
            })
        }, [
            hasActiveTarget,
            lastMessage?.id,
            messages,
            renderFingerprints,
            status,
            targetFromMessageId,
            targetMode,
            copyOnlyActions
        ])

        const keepMountedIndexes = useMemo(() => {
            const alwaysMountedIndexes = new Set<number>()

            if (targetFromMessageId) {
                const activeIndex = messages.findIndex(
                    (message) => message.id === targetFromMessageId
                )
                if (activeIndex >= 0 && activeIndex < virtualizedMessageCount) {
                    alwaysMountedIndexes.add(activeIndex)
                }
            }

            return [...alwaysMountedIndexes].sort((a, b) => a - b)
        }, [messages, targetFromMessageId, virtualizedMessageCount])

        const typingLoader = (
            <div
                className={cn(
                    "flex h-7 items-center",
                    (messages.length === 0 ||
                        (messages.length === 1 && lastMessage?.role === "assistant")) &&
                        "mt-12"
                )}
            >
                <Loader variant="typing" size="md" />
            </div>
        )
        const renderedMessageRows = messageRows.map((row) => (
            <div
                key={row.message.id}
                className={
                    row.message.role === "assistant" && row.message.id === lastMessage?.id
                        ? RESPONSE_SPACE_CLASS
                        : undefined
                }
            >
                {showTypingLoader &&
                row.message.role === "assistant" &&
                row.message.id === lastMessage?.id ? (
                    typingLoader
                ) : (
                    <MessageRow
                        message={row.message}
                        renderFingerprint={row.renderFingerprint}
                        liveRenderFingerprint={row.liveRenderFingerprint}
                        footerMetadataKey={row.footerMetadataKey}
                        isStreamingMessage={row.isStreamingMessage}
                        isEditing={row.isEditing}
                        initialConfig={
                            row.isEditing
                                ? getRetryTargetAssistantConfig(
                                      messages as Parameters<
                                          typeof getRetryTargetAssistantConfig
                                      >[0],
                                      row.message.id
                                  )
                                : undefined
                        }
                        folderId={folderId}
                        isFirstMessage={row.isFirstMessage}
                        hasActiveTarget={row.hasActiveTarget}
                        retryMessage={row.retryMessage}
                        onRetry={onRetry ? stableOnRetry : undefined}
                        onSwitchModel={copyOnlyActions ? undefined : handleSwitchModel}
                        onBranch={onBranch ? stableOnBranch : undefined}
                        onEdit={copyOnlyActions ? undefined : handleEdit}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit}
                        onFilePreview={handleFilePreview}
                        requiresVisionForModelSelection={threadHasVisionImageAttachments}
                        requiresNativePdfForModelSelection={threadHasPdfAttachments}
                        threadId={threadId}
                        sharedThreadId={sharedThreadId}
                        copyOnlyActions={copyOnlyActions}
                    />
                )}
            </div>
        ))
        const virtualizedMessageRows = renderedMessageRows.slice(0, virtualizedMessageCount)
        const directMessageRows = renderedMessageRows.slice(virtualizedMessageCount)

        useLayoutEffect(() => {
            void messages.length
            void lastMessage?.id
            void status

            if (!shouldStickToBottomRef.current || Date.now() < autoFollowPausedUntilRef.current) {
                return
            }

            scrollToStreamingEdge()
        }, [lastMessage?.id, messages.length, scrollToStreamingEdge, status])

        useEffect(() => {
            updateBottomState(true)
        }, [updateBottomState])

        useEffect(() => {
            if (
                lastMessage?.role !== "assistant" ||
                !("metadata" in lastMessage) ||
                !lastMessage.metadata ||
                lastMessageFooterMetadataKey === undefined
            ) {
                return
            }

            useMessageFooterStore
                .getState()
                .setFooterMetadata(lastMessage.id, lastMessage.metadata as AssistantMessageMetadata)
        }, [lastMessage?.id, lastMessage, lastMessageFooterMetadataKey])

        useEffect(() => {
            void threadKey

            shouldStickToBottomRef.current = true
            allowUnboundedStreamingFollowRef.current = false
            lastScrollOffsetRef.current = null
            if (scrollIdleTimerRef.current !== null) {
                clearTimeout(scrollIdleTimerRef.current)
                scrollIdleTimerRef.current = null
            }
            updateScrollDirection("idle")
            updateBottomState(true)

            const frameId = requestAnimationFrame(() => {
                scrollToBottom("auto")
            })

            return () => {
                cancelAnimationFrame(frameId)
            }
        }, [scrollToBottom, threadKey, updateBottomState, updateScrollDirection])

        useEffect(() => {
            const target = contentContainerRef.current
            if (!target || typeof ResizeObserver === "undefined") {
                return
            }

            let frameId: number | null = null
            const observer = new ResizeObserver(() => {
                if (
                    !shouldStickToBottomRef.current ||
                    Date.now() < autoFollowPausedUntilRef.current
                ) {
                    return
                }

                if (frameId !== null) {
                    cancelAnimationFrame(frameId)
                }

                frameId = requestAnimationFrame(() => {
                    if (
                        !shouldStickToBottomRef.current ||
                        Date.now() < autoFollowPausedUntilRef.current
                    )
                        return
                    scrollToStreamingEdge()
                })
            })

            observer.observe(target)

            return () => {
                if (frameId !== null) {
                    cancelAnimationFrame(frameId)
                }
                observer.disconnect()
            }
        }, [scrollToStreamingEdge])

        useEffect(() => {
            if (!onQuoteSelection) {
                return
            }

            const scroller = scrollerRef.current

            const isNodeWithinThread = (node: Node | null) => {
                const container = contentContainerRef.current
                if (!container || !node) {
                    return false
                }

                return container.contains(
                    node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode
                )
            }

            const updateQuoteSelection = () => {
                const selection = window.getSelection()

                if (
                    !selection ||
                    selection.rangeCount === 0 ||
                    selection.isCollapsed ||
                    !isNodeWithinThread(selection.anchorNode) ||
                    !isNodeWithinThread(selection.focusNode)
                ) {
                    setQuoteSelection(null)
                    return
                }

                const selectionText = formatQuotedSelection(selection.toString())
                if (!selectionText) {
                    setQuoteSelection(null)
                    return
                }

                const range = selection.getRangeAt(0)
                const rect = range.getBoundingClientRect()
                const fallbackRect = range.getClientRects()[0]
                const targetRect = rect.width > 0 || rect.height > 0 ? rect : fallbackRect

                if (!targetRect) {
                    setQuoteSelection(null)
                    return
                }

                const viewportWidth = window.innerWidth
                const viewportHeight = window.innerHeight
                const centeredX = targetRect.left + targetRect.width / 2
                const clampedX = Math.min(
                    Math.max(centeredX, QUOTE_TOOLTIP_MARGIN_PX + QUOTE_TOOLTIP_SIZE_PX / 2),
                    viewportWidth - QUOTE_TOOLTIP_MARGIN_PX - QUOTE_TOOLTIP_SIZE_PX / 2
                )
                const hasRoomAbove =
                    targetRect.top >=
                    QUOTE_TOOLTIP_SIZE_PX + QUOTE_TOOLTIP_MARGIN_PX + QUOTE_TOOLTIP_GAP_PX
                const hasRoomBelow =
                    viewportHeight - targetRect.bottom >=
                    QUOTE_TOOLTIP_SIZE_PX + QUOTE_TOOLTIP_MARGIN_PX + QUOTE_TOOLTIP_GAP_PX
                const placement =
                    hasRoomAbove || !hasRoomBelow ? ("above" as const) : ("below" as const)
                const tooltipY =
                    placement === "above"
                        ? targetRect.top - QUOTE_TOOLTIP_GAP_PX
                        : targetRect.bottom + QUOTE_TOOLTIP_GAP_PX

                setQuoteSelection({
                    selection: selection.toString(),
                    x: clampedX,
                    y: tooltipY,
                    placement
                })
            }

            const clearQuoteSelection = () => {
                setQuoteSelection(null)
            }

            document.addEventListener("selectionchange", updateQuoteSelection)
            window.addEventListener("resize", updateQuoteSelection)
            scroller?.addEventListener("scroll", updateQuoteSelection, { passive: true })

            return () => {
                document.removeEventListener("selectionchange", updateQuoteSelection)
                window.removeEventListener("resize", updateQuoteSelection)
                scroller?.removeEventListener("scroll", updateQuoteSelection)
                clearQuoteSelection()
            }
        }, [onQuoteSelection])

        return (
            <>
                <div
                    className="min-h-[calc(100dvh-var(--app-header-height)+var(--chat-composer-overlap))] overflow-y-auto p-4 pt-6 [overflow-anchor:none] md:[scrollbar-gutter:stable_both-edges]"
                    ref={scrollerRef}
                    onScroll={
                        shouldVirtualize
                            ? undefined
                            : (event) => handleScroll(event.currentTarget.scrollTop)
                    }
                >
                    <div
                        className={cn(
                            "mx-auto w-full pb-30",
                            getChatWidthClass(chatWidthState.chatWidth)
                        )}
                    >
                        <div ref={contentContainerRef} onClickCapture={handleContentClickCapture}>
                            {shouldVirtualize ? (
                                <Virtualizer
                                    ref={virtualizerRef}
                                    scrollRef={scrollerRef}
                                    bufferSize={MESSAGE_VIRTUALIZER_BUFFER}
                                    itemSize={MESSAGE_VIRTUALIZER_ITEM_SIZE}
                                    keepMounted={keepMountedIndexes}
                                    onScroll={handleScroll}
                                >
                                    {virtualizedMessageRows}
                                </Virtualizer>
                            ) : null}
                            {directMessageRows}

                            {showTypingLoader && lastMessage?.role !== "assistant" && (
                                <div className={RESPONSE_SPACE_CLASS}>{typingLoader}</div>
                            )}

                            {status === "error" &&
                                !lastMessage?.parts.some(
                                    (part) => part.type === "data-context-error"
                                ) && (
                                    <ChatErrorNotice
                                        error={error}
                                        onRetry={
                                            lastUserMessage
                                                ? () => onRetry?.(lastUserMessage)
                                                : undefined
                                        }
                                        onSwitchModel={handleSwitchModel}
                                    />
                                )}

                            <div className="min-h-12" aria-hidden="true" />
                        </div>
                    </div>
                </div>

                {quoteSelection && onQuoteSelection && (
                    <div
                        className="pointer-events-none fixed z-[60]"
                        style={{
                            left: quoteSelection.x,
                            top: quoteSelection.y,
                            transform:
                                quoteSelection.placement === "above"
                                    ? "translate(-50%, -100%)"
                                    : "translate(-50%, 0)"
                        }}
                    >
                        <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="pointer-events-auto size-8 rounded-md border border-border/70 bg-background/90 shadow-lg backdrop-blur-sm hover:bg-accent"
                            aria-label="Quote selection"
                            title="Quote selection"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                onQuoteSelection(quoteSelection.selection)
                                setQuoteSelection(null)
                                window.getSelection()?.removeAllRanges()
                            }}
                        >
                            <Quote className="size-4" />
                        </Button>
                    </div>
                )}

                <Dialog
                    open={previewDialogOpen}
                    onOpenChange={(open) => {
                        setPreviewDialogOpen(open)
                        if (!open) {
                            setTimeout(() => setPreviewFile(null), 100)
                        }
                    }}
                >
                    <DialogContent
                        showCloseButton={false}
                        className="md:!max-w-[min(90vw,60rem)] grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 sm:gap-4 sm:p-6"
                    >
                        {previewFile && (
                            <>
                                <DialogHeader className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <DialogTitle className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                            <span className="shrink-0">
                                                {getFileIcon(previewFile)}
                                            </span>
                                            <span className="truncate">
                                                {fileName || "Unknown file"}
                                            </span>
                                        </DialogTitle>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={previewDownloadPending}
                                            onClick={() => void handlePreviewDownload()}
                                            className="size-8 shrink-0 px-0 sm:h-8 sm:w-auto sm:px-3"
                                            aria-label={`Download ${fileName || "file"}`}
                                            title="Download"
                                        >
                                            {previewDownloadPending ? (
                                                <Loader size="sm" className="sm:mr-2" />
                                            ) : (
                                                <Download className="size-4 sm:mr-2" />
                                            )}
                                            <span className="hidden sm:inline">Download</span>
                                        </Button>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 shrink-0"
                                                aria-label="Close preview"
                                                title="Close"
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        </DialogClose>
                                    </div>
                                </DialogHeader>
                                {renderFilePreview()}
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </>
        )
    }
)

Messages.displayName = "Messages"
