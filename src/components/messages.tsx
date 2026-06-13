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
import { useSharedModels } from "@/lib/shared-models"
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
    Loader2,
    Paperclip,
    Quote,
    RotateCcw,
    Trash2,
    X
} from "lucide-react"
import { ArrowUp, MoreHorizontal } from "lucide-react"
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
import { MemoizedMarkdown } from "./memoized-markdown"
import { ModelSelector } from "./model-selector"
import {
    AspectRatioSelector,
    ImageResolutionSelector,
    ReasoningEffortSelector
} from "./multimodal-input"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning"
import { GenericToolRenderer } from "./renderers/generic-tool"
import { ImageGenerationToolRenderer } from "./renderers/image-generation-ui"
import { WebSearchToolRenderer } from "./renderers/web-search-ui"
import { ToolSelectorPopover } from "./tool-selector-popover"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "./ui/dropdown-menu"
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

const PartsRenderer = memo(
    ({
        part,
        markdown,
        id,
        onFilePreview,
        isStreaming
    }: {
        part: UIMessage["parts"][number]
        markdown: boolean
        id: string
        onFilePreview?: (part: { url: string; filename?: string; mediaType?: string }) => void
        isStreaming?: boolean
    }) => {
        switch (part.type) {
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
            case "tool-image_generation":
                return <ImageGenerationToolRenderer toolInvocation={part} />
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
        requiresNativePdfForModelSelection = false
    }: {
        message: UIMessage
        onSave: (
            newContent: string,
            remainingFileParts?: FileUIPart[],
            deletedUrls?: string[]
        ) => void
        onCancel: () => void
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

        const { selectedModel, setSelectedModel, enabledTools, setEnabledTools } = useModelStore()
        const { models: sharedModels } = useSharedModels()

        const [
            modelSupportsVision,
            modelSupportsNativePdf,
            modelSupportsFunctionCalling,
            isImageModel,
            modelSupportsImageSizing,
            modelSupportsImageResolution
        ] = useMemo(() => {
            if (!selectedModel) return [false, false, false, false, false, false]
            const model = sharedModels.find((m) => m.id === selectedModel)
            return [
                model?.abilities.includes("vision") ?? false,
                model?.abilities.includes("native_pdf") ?? false,
                model?.abilities.includes("function_calling") ?? false,
                model?.mode === "image",
                (model?.supportedImageSizes?.length ?? 0) > 0,
                (model?.supportedImageResolutions?.length ?? 0) > 0
            ]
        }, [selectedModel, sharedModels])

        const textContent = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")

        const fileParts = message.parts.filter((p): p is FileUIPart => p.type === "file")

        const [editedContent, setEditedContent] = useState(textContent)
        const [deletedUrls, setDeletedUrls] = useState<string[]>([])
        const [addedFiles, setAddedFiles] = useState<UploadedFile[]>([])
        const [uploading, setUploading] = useState(false)

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
            [modelSupportsNativePdf, modelSupportsVision, uploadFile, uploadPolicy]
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

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (matchesSaveMessageEditShortcut(e)) {
                e.preventDefault()
                handleSave()
            }
            if (matchesCancelMessageEditShortcut(e)) {
                onCancel()
            }
        }

        const totalAttachmentCount = fileParts.length + addedFiles.length

        return (
            <div
                className="border-2 border-input bg-background/80 p-3 shadow-xs backdrop-blur-lg dark:bg-input/70"
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
                                            style={{ borderRadius: "calc(var(--radius) - 2px)" }}
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
                                            "absolute h-6 w-6 opacity-0 shadow-sm transition-opacity group-hover:opacity-100",
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
                                        className="absolute top-1 right-1 h-6 w-6 bg-background/50 text-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                                        style={{ borderRadius: "var(--radius-xl)" }}
                                    >
                                        <X className="size-3.5" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 border-border/70 border-t pt-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {selectedModel && (
                            <ModelSelector
                                selectedModel={selectedModel}
                                onModelChange={setSelectedModel}
                                side="top"
                                className="border-0 bg-secondary/70 backdrop-blur-lg hover:bg-secondary/80"
                                requiresNativePdf={requiresNativePdfForModelSelection}
                            />
                        )}

                        {modelSupportsImageSizing && (
                            <AspectRatioSelector selectedModel={selectedModel} />
                        )}

                        {modelSupportsImageResolution && (
                            <ImageResolutionSelector selectedModel={selectedModel} />
                        )}

                        {!isImageModel && (
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="flex size-8 cursor-pointer items-center justify-center gap-1 bg-secondary/70 text-foreground backdrop-blur-lg hover:bg-secondary/80"
                                    style={{ borderRadius: "var(--radius-md)" }}
                                    title="Attach files"
                                >
                                    {uploading ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Paperclip className="-rotate-45 size-4" />
                                    )}
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept={getFileAcceptAttribute(modelSupportsVision)}
                                />
                                <ToolSelectorPopover
                                    threadId={threadId}
                                    enabledTools={enabledTools}
                                    onEnabledToolsChange={setEnabledTools}
                                    modelSupportsFunctionCalling={modelSupportsFunctionCalling}
                                />
                                <ReasoningEffortSelector selectedModel={selectedModel} />
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 bg-secondary/70 text-foreground backdrop-blur-lg hover:bg-secondary/80"
                                    style={{ borderRadius: "var(--radius-md)" }}
                                    title="More options"
                                >
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={onCancel}
                                    className="cursor-pointer text-destructive"
                                >
                                    <X className="mr-2 size-4" /> Cancel Edit
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

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
            </div>
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
    hasActiveTarget: boolean
    onRetry?: (message: UIMessage, configOverride?: AssistantConfigOverride) => void
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
}

const MessageRowComponent = ({
    message,
    isStreamingMessage,
    isEditing,
    hasActiveTarget,
    onRetry,
    onBranch,
    onEdit,
    onSaveEdit,
    onCancelEdit,
    onFilePreview,
    requiresNativePdfForModelSelection
}: MessageRowProps) => {
    const reasoning = getMessageReasoningDetails(message)
    const inlineParts = message.parts.filter(
        (part) => part.type !== "file" && part.type !== "reasoning"
    )
    const fileParts = message.parts.filter((part) => part.type === "file")

    return (
        <div className="pb-3">
            <div
                className={cn(
                    MESSAGE_MARKDOWN_CLASS,
                    "group prose-img:mx-auto prose-img:my-4 prose-pre:grid prose-code:before:hidden prose-code:after:hidden",
                    "mb-8",
                    message.role === "user" &&
                        !isEditing &&
                        "my-12 ml-auto w-fit max-w-md rounded-md border border-border bg-secondary/50 px-4 py-2 text-foreground"
                )}
            >
                {isEditing ? (
                    <EditableMessage
                        message={message}
                        onSave={onSaveEdit}
                        onCancel={onCancelEdit}
                        requiresNativePdfForModelSelection={requiresNativePdfForModelSelection}
                    />
                ) : (
                    <>
                        <div className="max-w-[calc(100vw-2rem)] overflow-hidden">
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
                                    onFilePreview={onFilePreview}
                                    isStreaming={isStreamingMessage}
                                />
                            ))}
                        </div>

                        {fileParts.length > 0 && (
                            <div className="not-prose mt-3 flex flex-col justify-start space-y-3">
                                {fileParts.map((part, index) => (
                                    <PartsRenderer
                                        key={`${message.id}-file-${index}`}
                                        part={part}
                                        markdown={message.role === "assistant"}
                                        id={`${message.id}-file-${index}`}
                                        onFilePreview={onFilePreview}
                                        isStreaming={isStreamingMessage}
                                    />
                                ))}
                            </div>
                        )}

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
                        ) : !hasActiveTarget && message.role === "assistant" ? (
                            <ChatActions
                                role={message.role}
                                message={message}
                                onRetry={undefined}
                                onBranch={isStreamingMessage ? undefined : onBranch}
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
    previousProps.hasActiveTarget === nextProps.hasActiveTarget &&
    previousProps.onRetry === nextProps.onRetry &&
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
                <div className="max-h-full overflow-auto">
                    {isImage && (
                        <img
                            src={resolvedPreviewUrl}
                            alt={fileName}
                            className="h-auto w-full rounded object-contain"
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
        const messageRows = useMemo(
            () =>
                messages.map((message) => {
                    const isStreamingMessage =
                        status === "streaming" && message.id === lastMessage?.id
                    const isEditing = targetFromMessageId === message.id && targetMode === "edit"
                    const shouldUseLiveFingerprint = isStreamingMessage || isEditing

                    return {
                        message,
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
                    className="min-h-[90dvh] overflow-y-auto p-4 pt-0 [overflow-anchor:none] md:[scrollbar-gutter:stable_both-edges]"
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
                                        hasActiveTarget={row.hasActiveTarget}
                                        onRetry={onRetry}
                                        onBranch={onBranch}
                                        onEdit={handleEdit}
                                        onSaveEdit={handleSaveEdit}
                                        onCancelEdit={handleCancelEdit}
                                        onFilePreview={handleFilePreview}
                                        requiresNativePdfForModelSelection={threadHasPdfAttachments}
                                    />
                                ))}
                            </Virtualizer>

                            {status === "error" && (
                                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive p-4">
                                    <div className="flex w-full items-center justify-between">
                                        <p className="text-destructive-foreground">
                                            Oops! Something went wrong.
                                        </p>
                                        {lastUserMessage && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => onRetry?.(lastUserMessage)}
                                                className="text-destructive-foreground hover:text-destructive-foreground/80"
                                            >
                                                <RotateCcw />
                                                Retry
                                            </Button>
                                        )}
                                    </div>
                                </div>
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
                    <DialogContent className="md:!max-w-[min(90vw,60rem)] max-h-[90dvh]">
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
