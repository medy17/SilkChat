import { api } from "@/convex/_generated/api"
import { useToken } from "@/hooks/auth-hooks"
import type { useChatIntegration } from "@/hooks/use-chat-integration"
import { useMessageRenderFingerprints } from "@/hooks/use-message-render-fingerprints"
import { useUploadPolicy } from "@/hooks/use-upload-policy"
import type { AssistantConfigOverride } from "@/lib/assistant-config"
import { getAttachmentValidationError, hasPdfAttachmentInMessages } from "@/lib/attachment-support"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { prepareChatAttachmentForUpload, uploadChatAttachment } from "@/lib/chat-attachments"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import { getFileAcceptAttribute, getFileTypeInfo, isImageMimeType } from "@/lib/file_constants"
import {
    matchesCancelMessageEditShortcut,
    matchesSaveMessageEditShortcut
} from "@/lib/keyboard-shortcuts"
import type { AssistantMessageMetadata } from "@/lib/message-footer-stats"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import { getMessageReasoningDetails } from "@/lib/message-reasoning"
import {
    getMessageFooterMetadataKey,
    getMessageRenderFingerprint
} from "@/lib/message-render-fingerprint"
import { useModelStore } from "@/lib/model-store"
import { formatQuotedSelection } from "@/lib/quote-selection"
import { getPublicR2AssetUrl, resolvePublicFileUrl } from "@/lib/r2-public-url"
import { cn } from "@/lib/utils"
import { useLocation } from "@tanstack/react-router"
import type { FileUIPart, Tool, UIMessage, UIToolInvocation } from "ai"
import { useMutation } from "convex/react"
import {
    Code,
    ExternalLink,
    FileType,
    FileType2,
    Image as ImageIcon,
    Quote,
    RotateCcw,
    Trash2,
    X
} from "lucide-react"
import { ArrowUp } from "lucide-react"
import {
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
import { ChatActions } from "./chat-actions"
import { ChatErrorNotice } from "./chat-error-notice"
import { MemoizedMarkdown } from "./memoized-markdown"
import { ModelSelector } from "./model-selector"
import {
    ComposerDesktopActions,
    ComposerMobileMenu,
    useComposerToolbarState
} from "./multimodal-input"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning"
import { GenericToolRenderer } from "./renderers/generic-tool"
import { ImageGenerationToolRenderer } from "./renderers/image-generation-ui"
import { MemoryRetrievalToolRenderer } from "./renderers/memory-retrieval-tool"
import { MemoryToolRenderer } from "./renderers/memory-tool"
import { WebSearchToolRenderer } from "./renderers/web-search-ui"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "./ui/alert-dialog"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Loader } from "./ui/loader"
import { Textarea } from "./ui/textarea"

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
    const resolvedFileName = part.filename || extractFileName(part.url)
    const { isImage, isCode, isPdf } = getFileTypeInfo(resolvedFileName, part.mediaType)

    if (isImage) return <ImageIcon className="size-4 text-blue-500" />
    if (isCode) return <Code className="size-4 text-green-500" />
    if (isPdf) return <FileType2 className="size-4 text-gray-500" />
    return <FileType className="size-4 text-gray-500" />
}

const hasVisibleAssistantContent = (message: UIMessage | undefined) => {
    if (!message || message.role !== "assistant" || !message.parts?.length) {
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

    if (!lastMessage || lastMessage.role !== "assistant") {
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
            <div
                className="group relative inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-secondary/50 p-3 transition-colors hover:bg-secondary/80"
                onClick={handleInteraction}
                onKeyDown={handleKeyDown}
                tabIndex={onPreview ? 0 : -1}
                role={onPreview ? "button" : undefined}
            >
                <div className="flex items-center gap-2">
                    {getFileIcon(part)}
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{fileName}</span>
                        <span className="text-muted-foreground text-xs">File</span>
                    </div>
                </div>
            </div>
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
        const [imageError, setImageError] = useState(false)

        const showImage = isImage && !imageError

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
                ) : (
                    <div className="flex min-w-0 items-center gap-2 text-foreground">
                        {isImage ? (
                            <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                            getFileIcon(part)
                        )}
                        <div className="flex min-w-0 flex-col">
                            <span className="max-w-[8.5rem] truncate font-medium text-xs">
                                {fileName}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {isImage ? "Unavailable" : "File"}
                            </span>
                        </div>
                    </div>
                )}
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
        messageId,
        onFilePreview,
        onSwitchModel,
        isStreaming
    }: {
        part: UIMessage["parts"][number]
        markdown: boolean
        id: string
        threadId?: string
        messageId: string
        onFilePreview?: (part: { url: string; filename?: string; mediaType?: string }) => void
        onSwitchModel?: (modelId: string) => void
        isStreaming?: boolean
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
            case "tool-web_search":
                return <WebSearchToolRenderer toolInvocation={part} />
            case "tool-execute_code":
                return (
                    <GenericToolRenderer
                        toolInvocation={part as UIToolInvocation<Tool>}
                        toolName="Code Execution"
                    />
                )
            case "tool-search_memories":
                return <MemoryRetrievalToolRenderer toolInvocation={part} mode="search" />
            case "tool-get_memory_profile":
                return <MemoryRetrievalToolRenderer toolInvocation={part} mode="profile" />
            case "tool-image_generation":
                return <ImageGenerationToolRenderer toolInvocation={part} />
            case "tool-prepareImageGeneration":
                return (
                    <ImageGenerationToolRenderer
                        toolInvocation={part}
                        threadId={threadId}
                        messageId={messageId}
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

const EditableMessage = memo(
    ({
        message,
        onSave,
        onCancel,
        cancelRequestRef,
        requiresNativePdfForModelSelection = false
    }: {
        message: UIMessage
        onSave: (
            newContent: string,
            remainingFileParts?: FileUIPart[],
            deletedUrls?: string[]
        ) => void
        onCancel: () => void
        cancelRequestRef?: React.MutableRefObject<(() => void) | null>
        requiresNativePdfForModelSelection?: boolean
    }) => {
        const location = useLocation()
        const { token } = useToken()
        const { policy: uploadPolicy, policyVersion, invalidateUploadPolicy } = useUploadPolicy()
        const deleteFileMutation = useMutation(api.attachments.deleteFile)
        const fileInputRef = useRef<HTMLInputElement>(null)
        const threadId = location.pathname.includes("/thread/")
            ? location.pathname.split("/thread/")[1]?.split("/")[0]
            : undefined

        const {
            selectedModel,
            setSelectedModel,
            enabledTools,
            setEnabledTools,
            reasoningEffort,
            setReasoningEffort
        } = useModelStore()
        const composerToolbar = useComposerToolbarState(threadId)
        const { modelSupportsVision, modelSupportsNativePdf } = composerToolbar

        const textContent = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")

        const fileParts = message.parts.filter((p): p is FileUIPart => p.type === "file")

        const [editedContent, setEditedContent] = useState(textContent)
        const [deletedUrls, setDeletedUrls] = useState<string[]>([])
        const [addedFiles, setAddedFiles] = useState<UploadedFile[]>([])
        const [uploading, setUploading] = useState(false)
        const [showCancelConfirmation, setShowCancelConfirmation] = useState(false)
        const initialEditSettingsRef = useRef({
            selectedModel,
            enabledTools: [...enabledTools],
            reasoningEffort
        })

        const haveToolsChanged =
            enabledTools.length !== initialEditSettingsRef.current.enabledTools.length ||
            enabledTools.some(
                (tool, index) => tool !== initialEditSettingsRef.current.enabledTools[index]
            )

        const hasUnsavedChanges =
            editedContent !== textContent ||
            deletedUrls.length > 0 ||
            addedFiles.length > 0 ||
            selectedModel !== initialEditSettingsRef.current.selectedModel ||
            reasoningEffort !== initialEditSettingsRef.current.reasoningEffort ||
            haveToolsChanged

        const uploadFile = useCallback(
            async (file: File): Promise<UploadedFile> => {
                const jwt = await resolveJwtToken(token)
                if (!jwt) {
                    throw new Error("Authentication token unavailable")
                }

                return uploadChatAttachment({
                    file,
                    jwt,
                    uploadUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
                    policyVersion,
                    onPolicyVersionMismatch: invalidateUploadPolicy
                })
            },
            [invalidateUploadPolicy, policyVersion, token]
        )

        const handleAddFiles = useCallback(
            async (files: File[]) => {
                if (uploading) return
                if (files.length === 0) return

                const validationErrors = files
                    .map((file) =>
                        getAttachmentValidationError(
                            {
                                name: file.name,
                                mimeType: file.type,
                                size: file.size
                            },
                            {
                                supportsVision: modelSupportsVision,
                                supportsNativePdf: modelSupportsNativePdf
                            },
                            uploadPolicy
                        )
                    )
                    .filter((error): error is string => Boolean(error))

                if (validationErrors.length > 0) {
                    toast.error(`File validation failed:\n${validationErrors.join("\n")}`)
                    return
                }

                setUploading(true)
                try {
                    const uploadableFiles = await Promise.all(
                        files.map((file) => prepareChatAttachmentForUpload(file, uploadPolicy))
                    )
                    const uploaded = await Promise.all(uploadableFiles.map(uploadFile))
                    setAddedFiles((current) => [...current, ...uploaded])
                } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Upload failed")
                } finally {
                    setUploading(false)
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                    }
                }
            },
            [modelSupportsNativePdf, modelSupportsVision, uploadFile, uploadPolicy, uploading]
        )

        const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            if (event.target.files) {
                void handleAddFiles(Array.from(event.target.files))
            }
        }

        const removeAddedFile = (file: UploadedFile) => {
            setAddedFiles((current) => current.filter((addedFile) => addedFile.key !== file.key))
            deleteFileMutation({ key: file.key }).catch(console.error)
        }

        const handleSave = () => {
            const remainingFileParts = fileParts.filter((p) => !deletedUrls.includes(p.url))
            const addedFileParts = addedFiles.map(
                (file) =>
                    ({
                        type: "file",
                        url: getPublicR2AssetUrl(file.key),
                        mediaType: file.fileType,
                        filename: file.fileName
                    }) satisfies FileUIPart
            )
            const nextFileParts = [...remainingFileParts, ...addedFileParts]
            onSave(
                editedContent,
                nextFileParts.length > 0 ? nextFileParts : undefined,
                deletedUrls.length > 0 ? deletedUrls : undefined
            )
        }

        const discardAddedFiles = useCallback(() => {
            for (const file of addedFiles) {
                deleteFileMutation({ key: file.key }).catch(console.error)
            }
        }, [addedFiles, deleteFileMutation])

        const restoreInitialEditSettings = useCallback(() => {
            const initialSettings = initialEditSettingsRef.current

            setSelectedModel(initialSettings.selectedModel)
            setEnabledTools(initialSettings.enabledTools)
            setReasoningEffort(initialSettings.reasoningEffort)
        }, [setEnabledTools, setReasoningEffort, setSelectedModel])

        const commitCancel = useCallback(() => {
            if (addedFiles.length > 0) {
                discardAddedFiles()
            }
            restoreInitialEditSettings()
            onCancel()
        }, [addedFiles.length, discardAddedFiles, onCancel, restoreInitialEditSettings])

        const requestCancel = useCallback(() => {
            if (!hasUnsavedChanges) {
                commitCancel()
                return
            }

            setShowCancelConfirmation(true)
        }, [commitCancel, hasUnsavedChanges])

        const handleConfirmCancel = useCallback(() => {
            setShowCancelConfirmation(false)
            commitCancel()
        }, [commitCancel])

        useEffect(() => {
            if (!cancelRequestRef) return

            cancelRequestRef.current = requestCancel
            return () => {
                cancelRequestRef.current = null
            }
        }, [cancelRequestRef, requestCancel])

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (matchesSaveMessageEditShortcut(e)) {
                e.preventDefault()
                handleSave()
            }
            if (matchesCancelMessageEditShortcut(e)) {
                e.preventDefault()
                requestCancel()
            }
        }

        const totalAttachmentCount = fileParts.length + addedFiles.length

        return (
            <>
                <div
                    className="@container border-2 border-input bg-background/80 p-3 shadow-xs backdrop-blur-lg dark:bg-input/70"
                    style={{ borderRadius: "var(--radius-lg)" }}
                >
                    <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="min-h-24 w-full resize-none border-none bg-transparent p-0 pb-3 text-foreground shadow-none outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />

                    {totalAttachmentCount > 0 && (
                        <div className="flex flex-wrap gap-2 pb-3">
                            {fileParts.map((part, index) => {
                                const { isImage } = getFileTypeInfo(
                                    part.filename || extractFileName(part.url),
                                    part.mediaType
                                )
                                const isRemoved = deletedUrls.includes(part.url)
                                const isCompact = totalAttachmentCount > 1
                                const filename = part.filename || extractFileName(part.url)

                                const handleToggleRemove = () => {
                                    setDeletedUrls((prev) =>
                                        prev.includes(part.url)
                                            ? prev.filter((url) => url !== part.url)
                                            : [...prev, part.url]
                                    )
                                }

                                return (
                                    <div
                                        key={index}
                                        className={cn(
                                            "group relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-secondary/50 transition-all hover:bg-secondary/80",
                                            isCompact || !isImage
                                                ? "h-12 w-auto min-w-12 max-w-52"
                                                : "h-auto max-h-64 w-auto max-w-full",
                                            isImage && isCompact ? "w-12 p-0" : "px-3",
                                            isRemoved && "opacity-50 grayscale-[50%]"
                                        )}
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        {isImage ? (
                                            <img
                                                src={resolvePublicFileUrl(part.url)}
                                                alt={filename}
                                                className={cn(
                                                    "object-cover",
                                                    isCompact
                                                        ? "h-full w-full"
                                                        : "h-auto max-h-64 w-auto"
                                                )}
                                                style={{
                                                    borderRadius: "calc(var(--radius) - 2px)"
                                                }}
                                            />
                                        ) : (
                                            <div className="flex min-w-0 items-center gap-2 text-foreground">
                                                {getFileIcon(part)}
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="max-w-[8.5rem] truncate font-medium text-xs">
                                                        {filename}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        Existing
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {isRemoved && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                                                <Trash2 className="size-5 text-destructive drop-shadow-md" />
                                            </div>
                                        )}

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            onClick={handleToggleRemove}
                                            title={
                                                isRemoved
                                                    ? "Restore attachment"
                                                    : "Remove attachment from message"
                                            }
                                            className={cn(
                                                "absolute h-6 w-6 opacity-100 shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100",
                                                isRemoved
                                                    ? "top-1 right-1 bg-background/80 text-foreground"
                                                    : "bg-background/50 text-foreground hover:bg-destructive hover:text-destructive-foreground",
                                                !isRemoved &&
                                                    (!isCompact && !isImage
                                                        ? "-translate-y-1/2 top-1/2 right-2"
                                                        : "top-1 right-1")
                                            )}
                                            style={{ borderRadius: "var(--radius-xl)" }}
                                        >
                                            {isRemoved ? (
                                                <RotateCcw className="size-3.5" />
                                            ) : (
                                                <X className="size-3.5" />
                                            )}
                                        </Button>
                                    </div>
                                )
                            })}

                            {addedFiles.map((file) => {
                                const isImage = isImageMimeType(file.fileType)

                                return (
                                    <div
                                        key={file.key}
                                        className="group relative flex h-12 min-w-12 max-w-52 shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-secondary/50 px-3 transition-all hover:bg-secondary/80"
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        <div className="flex min-w-0 items-center gap-2 text-foreground">
                                            {isImage ? (
                                                <img
                                                    src={getPublicR2AssetUrl(file.key)}
                                                    alt={file.fileName}
                                                    className="size-8 object-cover"
                                                    style={{
                                                        borderRadius: "calc(var(--radius) - 2px)"
                                                    }}
                                                />
                                            ) : (
                                                getFileIcon({
                                                    url: getPublicR2AssetUrl(file.key),
                                                    filename: file.fileName,
                                                    mediaType: file.fileType
                                                })
                                            )}
                                            <div className="flex min-w-0 flex-col">
                                                <span className="max-w-[8.5rem] truncate font-medium text-xs">
                                                    {file.fileName}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    New
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            onClick={() => removeAddedFile(file)}
                                            title="Remove attachment from message"
                                            className="absolute top-1 right-1 h-6 w-6 bg-background/50 text-foreground opacity-100 shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground md:opacity-0 md:group-hover:opacity-100"
                                            style={{ borderRadius: "var(--radius-xl)" }}
                                        >
                                            <X className="size-3.5" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <div className="flex items-center gap-2 border-border/70 border-t pt-3">
                        <div className="flex min-w-0 flex-1 items-center @3xl:gap-2 gap-1.5 overflow-hidden @3xl:overflow-visible">
                            {selectedModel && (
                                <ModelSelector
                                    selectedModel={selectedModel}
                                    onModelChange={setSelectedModel}
                                    side="top"
                                    className="border-0 bg-secondary/70 backdrop-blur-lg hover:bg-secondary/80"
                                    requiresNativePdf={requiresNativePdfForModelSelection}
                                />
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                accept={getFileAcceptAttribute(modelSupportsVision)}
                            />
                            <ComposerDesktopActions
                                state={composerToolbar}
                                threadId={threadId}
                                uploading={uploading}
                                onAttachClick={() => fileInputRef.current?.click()}
                            />
                        </div>

                        <ComposerMobileMenu
                            state={composerToolbar}
                            onAttachClick={() => fileInputRef.current?.click()}
                        />

                        <Button
                            size="icon"
                            className="size-8 shrink-0"
                            style={{ borderRadius: "var(--radius-md)" }}
                            onClick={handleSave}
                            disabled={uploading}
                            title="Send"
                        >
                            <ArrowUp className="size-5" />
                        </Button>
                    </div>
                </div>

                <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Discard edit?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Your message changes will be lost if you cancel now.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Keep editing</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleConfirmCancel}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Discard changes
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </>
        )
    }
)
EditableMessage.displayName = "EditableMessage"

const MESSAGE_KEEP_MOUNTED_TAIL_COUNT = 40
const MESSAGE_VIRTUALIZER_BUFFER = 700
const MESSAGE_VIRTUALIZER_ITEM_SIZE = 208
const BOTTOM_SCROLL_THRESHOLD_PX = 4
const MESSAGE_MARKDOWN_CLASS =
    "prose relative max-w-none prose-pre:bg-transparent prose-pre:p-0 font-claude-message prose-headings:font-semibold prose-strong:font-medium prose-pre:text-foreground leading-7 [&_.ignore-pre-bg>div]:bg-transparent [&_pre>div]:border-0.5 [&_pre>div]:border-border [&_pre>div]:bg-background"
const REASONING_MARKDOWN_CLASS =
    "prose max-w-none prose-pre:bg-transparent p-4 prose-pre:p-0 font-claude-message prose-headings:font-semibold prose-strong:font-medium prose-pre:text-foreground leading-7 [&_.ignore-pre-bg>div]:bg-transparent [&_pre>div]:border-0.5 [&_pre>div]:border-border [&_pre>div]:bg-background"
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

type MessageRowProps = {
    message: UIMessage
    renderFingerprint: string
    liveRenderFingerprint?: string
    footerMetadataKey?: string
    isStreamingMessage: boolean
    isEditing: boolean
    isFirstMessage: boolean
    hasActiveTarget: boolean
    onRetry?: (message: UIMessage, configOverride?: AssistantConfigOverride) => void
    onSwitchModel?: (modelId: string) => void
    onBranch?: (message: UIMessage) => void
    onEdit: (message: UIMessage) => void
    onSaveEdit: (
        newContent: string,
        remainingFileParts?: FileUIPart[],
        deletedUrls?: string[]
    ) => void
    onCancelEdit: () => void
    onFilePreview: (part: PreviewFile) => void
    requiresNativePdfForModelSelection: boolean
    threadId?: string
}

const MessageRowComponent = ({
    message,
    isStreamingMessage,
    isEditing,
    isFirstMessage,
    hasActiveTarget,
    onRetry,
    onSwitchModel,
    onBranch,
    onEdit,
    onSaveEdit,
    onCancelEdit,
    onFilePreview,
    requiresNativePdfForModelSelection,
    threadId
}: MessageRowProps) => {
    const reasoning = getMessageReasoningDetails(message)
    const inlineParts = message.parts.filter(
        (part) => part.type !== "file" && part.type !== "reasoning"
    )
    const fileParts = message.parts.filter((part) => part.type === "file")
    const cancelEditRequestRef = useRef<(() => void) | null>(null)
    const bubbleRef = useRef<HTMLDivElement>(null)
    const bubbleRectRef = useRef<{ width: number; height: number } | null>(null)
    const prevIsEditingRef = useRef(isEditing)

    // FLIP the message bubble when entering/leaving edit mode. The outer element is
    // the same node across the toggle, so measuring before/after gives real pixel
    // sizes — which a CSS keyframe can't, since the resting bubble is content-sized
    // (w-fit) and clamped by max-width. We animate both dimensions so the transition
    // reads correctly on any viewport: on desktop the width delta dominates (the
    // clamped bubble grows to full width), while on mobile the bubble is already
    // ~full width, so the height delta dominates and it reads as the box growing tall.
    useLayoutEffect(() => {
        if (message.role !== "user") return

        const element = bubbleRef.current
        if (!element) return

        const rect = element.getBoundingClientRect()
        const nextWidth = rect.width
        const nextHeight = rect.height
        const editingChanged = prevIsEditingRef.current !== isEditing
        const prevRect = bubbleRectRef.current

        bubbleRectRef.current = { width: nextWidth, height: nextHeight }
        prevIsEditingRef.current = isEditing

        if (!editingChanged || prevRect === null) {
            return
        }

        const widthChanged = Math.abs(prevRect.width - nextWidth) >= 1
        const heightChanged = Math.abs(prevRect.height - nextHeight) >= 1
        if (!widthChanged && !heightChanged) {
            return
        }

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return
        }

        element.animate(
            [
                {
                    width: `${prevRect.width}px`,
                    height: `${prevRect.height}px`,
                    maxWidth: "none",
                    overflow: "hidden"
                },
                {
                    width: `${nextWidth}px`,
                    height: `${nextHeight}px`,
                    maxWidth: "none",
                    overflow: "hidden"
                }
            ],
            { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
        )
    })

    return (
        <div className="pb-3">
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
                    message.role === "user" &&
                        !isEditing &&
                        "my-12 ml-auto w-fit max-w-[min(28rem,100%)] rounded-md border border-border bg-secondary/50 px-4 py-2 text-foreground",
                    message.role === "user" && isEditing && "mt-12 ml-auto w-full"
                )}
            >
                {isEditing ? (
                    <>
                        <EditableMessage
                            message={message}
                            onSave={onSaveEdit}
                            onCancel={onCancelEdit}
                            cancelRequestRef={cancelEditRequestRef}
                            requiresNativePdfForModelSelection={requiresNativePdfForModelSelection}
                        />
                        <ChatActions
                            role={message.role}
                            message={message}
                            onRetry={onRetry}
                            onEdit={onEdit}
                            editing
                            onCancelEdit={() => cancelEditRequestRef.current?.()}
                            requiresNativePdfForModelSelection={requiresNativePdfForModelSelection}
                        />
                    </>
                ) : (
                    <>
                        <div className="max-w-full overflow-hidden">
                            {reasoning && (
                                <Reasoning
                                    className="mb-6"
                                    isStreaming={isStreamingMessage && reasoning.isStreaming}
                                >
                                    <ReasoningTrigger className="mb-4">Reasoning</ReasoningTrigger>
                                    <ReasoningContent
                                        markdown={message.role === "assistant"}
                                        isAnimating={isStreamingMessage && reasoning.isStreaming}
                                        className="rounded-lg border bg-muted/50"
                                        contentClassName={REASONING_MARKDOWN_CLASS}
                                    >
                                        {reasoning.text}
                                    </ReasoningContent>
                                </Reasoning>
                            )}

                            {inlineParts.map((part, index) => (
                                <PartsRenderer
                                    key={`${message.id}-text-${index}`}
                                    part={part}
                                    markdown={true}
                                    id={`${message.id}-text-${index}`}
                                    threadId={
                                        ((message.metadata as { threadId?: string } | undefined)
                                            ?.threadId as string | undefined) ?? threadId
                                    }
                                    messageId={message.id}
                                    onFilePreview={onFilePreview}
                                    onSwitchModel={onSwitchModel}
                                    isStreaming={isStreamingMessage}
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
                                        ((message.metadata as { threadId?: string } | undefined)
                                            ?.threadId as string | undefined) ?? threadId
                                    }
                                    messageId={message.id}
                                    onFilePreview={onFilePreview}
                                    isStreaming={isStreamingMessage}
                                />
                            </div>
                        ) : null}

                        {!hasActiveTarget && message.role === "user" ? (
                            <ChatActions
                                role={message.role}
                                message={message}
                                onRetry={onRetry}
                                onEdit={onEdit}
                                requiresNativePdfForModelSelection={
                                    requiresNativePdfForModelSelection
                                }
                            />
                        ) : !hasActiveTarget &&
                          message.role === "assistant" &&
                          !isStreamingMessage ? (
                            <ChatActions
                                role={message.role}
                                message={message}
                                onRetry={undefined}
                                onBranch={onBranch}
                                onEdit={undefined}
                            />
                        ) : null}
                    </>
                )}
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
    previousProps.onRetry === nextProps.onRetry &&
    previousProps.onSwitchModel === nextProps.onSwitchModel &&
    previousProps.onBranch === nextProps.onBranch &&
    previousProps.onEdit === nextProps.onEdit &&
    previousProps.onSaveEdit === nextProps.onSaveEdit &&
    previousProps.onCancelEdit === nextProps.onCancelEdit &&
    previousProps.onFilePreview === nextProps.onFilePreview &&
    previousProps.requiresNativePdfForModelSelection ===
        nextProps.requiresNativePdfForModelSelection

const MessageRow = memo(MessageRowComponent, areMessageRowPropsEqual)
MessageRow.displayName = "MessageRow"

export type MessagesHandle = {
    scrollToBottom: (behavior?: ScrollBehavior) => void
}

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
            deletedUrls?: string[]
        ) => void
        onQuoteSelection?: (selection: string) => void
        status: ReturnType<typeof useChatIntegration>["status"]
        error?: ReturnType<typeof useChatIntegration>["error"]
        onBottomStateChange?: (isAtBottom: boolean) => void
        threadKey?: string
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
            threadKey
        },
        ref
    ) => {
        const { setTargetFromMessageId, targetFromMessageId, setTargetMode, targetMode } =
            useChatStore()
        const { chatWidthState } = useChatWidthStore()
        const scrollerRef = useRef<HTMLDivElement>(null)
        const contentContainerRef = useRef<HTMLDivElement>(null)
        const virtualizerRef = useRef<VirtualizerHandle>(null)
        const isAtBottomRef = useRef(true)
        const shouldStickToBottomRef = useRef(true)

        const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
        const [previewFile, setPreviewFile] = useState<{
            url: string
            filename?: string
            mediaType?: string
        } | null>(null)
        const [quoteSelection, setQuoteSelection] = useState<QuoteSelectionState | null>(null)

        const handleEdit = useCallback(
            (message: UIMessage) => {
                setTargetFromMessageId(message.id)
                setTargetMode("edit")
            },
            [setTargetFromMessageId, setTargetMode]
        )

        const handleSaveEdit = useCallback(
            (newContent: string, remainingFileParts?: FileUIPart[], deletedUrls?: string[]) => {
                if (targetFromMessageId && onEditAndRetry) {
                    onEditAndRetry(targetFromMessageId, newContent, remainingFileParts, deletedUrls)
                }
                setTargetFromMessageId(undefined)
                setTargetMode("normal")
            },
            [onEditAndRetry, setTargetFromMessageId, setTargetMode, targetFromMessageId]
        )

        const handleCancelEdit = useCallback(() => {
            setTargetFromMessageId(undefined)
            setTargetMode("normal")
        }, [setTargetFromMessageId, setTargetMode])

        const handleFilePreview = useCallback((part: PreviewFile) => {
            setPreviewFile(part)
            setPreviewDialogOpen(true)
        }, [])
        const renderFingerprints = useMessageRenderFingerprints(messages)
        const threadHasPdfAttachments = useMemo(
            () => hasPdfAttachmentInMessages(messages),
            [messages]
        )

        const fileName = previewFile?.filename || extractFileName(previewFile?.url || "")

        const renderFilePreview = () => {
            if (!previewFile) return null

            const resolvedPreviewUrl = resolvePublicFileUrl(previewFile.url)
            const { isImage, isText, isPdf } = getFileTypeInfo(fileName, previewFile.mediaType)
            const isExternalPreviewUrl =
                resolvedPreviewUrl.startsWith("http://") ||
                resolvedPreviewUrl.startsWith("https://")
            const shouldUseGenericExternalPreview =
                !isImage && !isText && !isPdf && isExternalPreviewUrl

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

                    {(isText || isPdf) && (
                        <iframe
                            src={resolvedPreviewUrl}
                            className="h-[69dvh] w-full rounded border-0"
                            title={fileName}
                        />
                    )}

                    {shouldUseGenericExternalPreview && (
                        <div className="space-y-3">
                            <iframe
                                src={resolvedPreviewUrl}
                                className="h-[69dvh] w-full rounded border-0"
                                title={fileName}
                            />
                            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Preview type could not be detected from this external URL. If
                                    the embed is blank, open the source directly.
                                </p>
                                <Button asChild variant="outline" size="sm">
                                    <a href={resolvedPreviewUrl} target="_blank" rel="noreferrer">
                                        <ExternalLink className="mr-2 size-4" />
                                        Open Original
                                    </a>
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isImage && !isText && !isPdf && !shouldUseGenericExternalPreview && (
                        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                            <p className="font-medium">Preview unavailable</p>
                            <p className="mt-1 text-muted-foreground">
                                This file type could not be detected for inline preview.
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
        const hasActiveTarget = Boolean(targetFromMessageId)
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

        const syncBottomStateFromOffset = useCallback(
            (offset?: number) => {
                const handle = virtualizerRef.current
                if (!handle) {
                    return
                }

                const scrollOffset = offset ?? handle.scrollOffset
                const distanceFromBottom = Math.max(
                    0,
                    handle.scrollSize - handle.viewportSize - scrollOffset
                )
                const isAtBottom = distanceFromBottom <= BOTTOM_SCROLL_THRESHOLD_PX

                shouldStickToBottomRef.current = isAtBottom
                updateBottomState(isAtBottom)
            },
            [updateBottomState]
        )

        const scrollToBottom = useCallback(
            (behavior: ScrollBehavior = "auto") => {
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
        const handleSwitchModel = useMemo(
            () =>
                lastUserMessage
                    ? (modelId: string) => onRetry?.(lastUserMessage, { modelIdOverride: modelId })
                    : undefined,
            [lastUserMessage, onRetry]
        )
        const messageRows = useMemo(
            () =>
                messages.map((message, index) => {
                    const isStreamingMessage =
                        status === "streaming" && message.id === lastMessage?.id
                    const isEditing = targetFromMessageId === message.id && targetMode === "edit"
                    const shouldUseLiveFingerprint = isStreamingMessage || isEditing

                    return {
                        message,
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
                }),
            [
                hasActiveTarget,
                lastMessage?.id,
                messages,
                renderFingerprints,
                status,
                targetFromMessageId,
                targetMode
            ]
        )

        const keepMountedIndexes = useMemo(() => {
            const alwaysMountedIndexes = new Set<number>()
            const tailStartIndex = Math.max(0, messages.length - MESSAGE_KEEP_MOUNTED_TAIL_COUNT)

            for (let index = tailStartIndex; index < messages.length; index += 1) {
                alwaysMountedIndexes.add(index)
            }

            if (targetFromMessageId) {
                const activeIndex = messages.findIndex(
                    (message) => message.id === targetFromMessageId
                )
                if (activeIndex >= 0) {
                    alwaysMountedIndexes.add(activeIndex)
                }
            }

            return [...alwaysMountedIndexes].sort((a, b) => a - b)
        }, [messages, targetFromMessageId])

        useLayoutEffect(() => {
            void messages.length
            void lastMessage?.id
            void status

            if (!shouldStickToBottomRef.current) {
                return
            }

            scrollToBottom("auto")
        }, [lastMessage?.id, messages.length, scrollToBottom, status])

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
            updateBottomState(true)

            const frameId = requestAnimationFrame(() => {
                scrollToBottom("auto")
            })

            return () => {
                cancelAnimationFrame(frameId)
            }
        }, [scrollToBottom, threadKey, updateBottomState])

        useEffect(() => {
            const target = contentContainerRef.current
            if (!target || typeof ResizeObserver === "undefined") {
                return
            }

            let frameId: number | null = null
            const observer = new ResizeObserver(() => {
                if (!shouldStickToBottomRef.current) {
                    return
                }

                if (frameId !== null) {
                    cancelAnimationFrame(frameId)
                }

                frameId = requestAnimationFrame(() => {
                    scrollToBottom("auto")
                })
            })

            observer.observe(target)

            return () => {
                if (frameId !== null) {
                    cancelAnimationFrame(frameId)
                }
                observer.disconnect()
            }
        }, [scrollToBottom])

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
                    className="min-h-[90dvh] overflow-y-auto p-4 pt-6 [overflow-anchor:none] md:[scrollbar-gutter:stable_both-edges]"
                    ref={scrollerRef}
                >
                    <div
                        className={cn(
                            "mx-auto w-full pb-16",
                            getChatWidthClass(chatWidthState.chatWidth)
                        )}
                    >
                        <div ref={contentContainerRef}>
                            <Virtualizer
                                ref={virtualizerRef}
                                scrollRef={scrollerRef}
                                bufferSize={MESSAGE_VIRTUALIZER_BUFFER}
                                itemSize={MESSAGE_VIRTUALIZER_ITEM_SIZE}
                                keepMounted={keepMountedIndexes}
                                onScroll={syncBottomStateFromOffset}
                            >
                                {messageRows.map((row) => (
                                    <MessageRow
                                        key={row.message.id}
                                        message={row.message}
                                        renderFingerprint={row.renderFingerprint}
                                        liveRenderFingerprint={row.liveRenderFingerprint}
                                        footerMetadataKey={row.footerMetadataKey}
                                        isStreamingMessage={row.isStreamingMessage}
                                        isEditing={row.isEditing}
                                        isFirstMessage={row.isFirstMessage}
                                        hasActiveTarget={row.hasActiveTarget}
                                        onRetry={onRetry}
                                        onSwitchModel={handleSwitchModel}
                                        onBranch={onBranch}
                                        onEdit={handleEdit}
                                        onSaveEdit={handleSaveEdit}
                                        onCancelEdit={handleCancelEdit}
                                        onFilePreview={handleFilePreview}
                                        requiresNativePdfForModelSelection={threadHasPdfAttachments}
                                        threadId={threadKey}
                                    />
                                ))}
                            </Virtualizer>

                            {status === "error" && (
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

                            <div className="flex min-h-[3rem] items-center gap-2 py-4">
                                {showTypingLoader && <Loader variant="typing" size="md" />}
                            </div>
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
                    <DialogContent className="md:!max-w-[min(90vw,60rem)] grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
                        {previewFile && (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        {getFileIcon(previewFile)}
                                        {fileName || "Unknown file"}
                                    </DialogTitle>
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
