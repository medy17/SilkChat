import { api } from "@/convex/_generated/api"
import { useToken } from "@/hooks/auth-hooks"
import type { useChatIntegration } from "@/hooks/use-chat-integration"
import { useMessageRenderFingerprints } from "@/hooks/use-message-render-fingerprints"
import { useUploadPolicy } from "@/hooks/use-upload-policy"
import type { AssistantConfigOverride } from "@/lib/assistant-config"
import {
    createInlineIngestedFile,
    finalizeIngestedUpload,
    ingestChatAttachment
} from "@/lib/attachment-ingest"
import { getAttachmentValidationError, hasPdfAttachmentInMessages } from "@/lib/attachment-support"
import {
    getAttachmentTileKind,
    getAttachmentTileMediaType,
    isLargePasteMediaType
} from "@/lib/attachment-tile"
import { resolveJwtToken } from "@/lib/auth-token"
import { getToolFailureAttempt, getToolFailureAttempts } from "@/lib/blocked-tool-attempt"
import { browserEnv } from "@/lib/browser-env"
import { prepareChatAttachmentForUpload, uploadChatAttachment } from "@/lib/chat-attachments"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import {
    getFileAcceptAttribute,
    getFileTypeInfo,
    isDocumentExtension,
    isImageMimeType
} from "@/lib/file_constants"
import { playResponseCompleteHaptic, playResponseStartHaptic } from "@/lib/haptics"
import {
    matchesCancelMessageEditShortcut,
    matchesSaveMessageEditShortcut
} from "@/lib/keyboard-shortcuts"
import { getMessageCodeExecutions } from "@/lib/message-code-executions"
import type { AssistantMessageMetadata } from "@/lib/message-footer-stats"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import { getVirtualizedMessageCount, shouldVirtualizeMessageList } from "@/lib/message-list-mode"
import { getMessageReasoningDetails } from "@/lib/message-reasoning"
import {
    getMessageFooterMetadataKey,
    getMessageRenderFingerprint
} from "@/lib/message-render-fingerprint"
import { getMessageWebSearches } from "@/lib/message-web-searches"
import { useModelStore } from "@/lib/model-store"
import { getEnabledToolsForPastedText } from "@/lib/pasted-text"
import { formatQuotedSelection } from "@/lib/quote-selection"
import { getPublicR2AssetUrl, resolvePublicFileUrl } from "@/lib/r2-public-url"
import { isTabularTextFile } from "@/lib/tabular-file-preview"
import { cn, downloadUrl } from "@/lib/utils"
import { useLocation } from "@tanstack/react-router"
import type { FileUIPart, Tool, UIMessage, UIToolInvocation } from "ai"
import { useMutation } from "convex/react"
import {
    Code,
    Download,
    FileText,
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
import { MemoizedMarkdown } from "./memoized-markdown"
import { ModelSelector } from "./model-selector"
import {
    ComposerDesktopActions,
    ComposerMobileMenu,
    useComposerToolbarState
} from "./multimodal-input"
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
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Loader } from "./ui/loader"
import { Textarea } from "./ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

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

type EditUploadingFile = {
    id: string
    file: File
    displayName: string
    tileKind: "attachment" | "large-paste"
    progress: number
    status: "uploading" | "success" | "ready" | "error"
    previewUrl?: string
    error?: string
}

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
        const activeUploadControllersRef = useRef(new Set<AbortController>())
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
        const composerToolbar = useComposerToolbarState()
        const {
            modelSupportsFunctionCalling,
            modelSupportsVision,
            modelSupportsNativePdf,
            codeExecutionAvailable
        } = composerToolbar

        const textContent = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")

        const fileParts = message.parts.filter((p): p is FileUIPart => p.type === "file")

        const [editedContent, setEditedContent] = useState(textContent)
        const [deletedUrls, setDeletedUrls] = useState<string[]>([])
        const [addedFiles, setAddedFiles] = useState<UploadedFile[]>([])
        const [uploadingFiles, setUploadingFiles] = useState<EditUploadingFile[]>([])
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
            uploadingFiles.length > 0 ||
            selectedModel !== initialEditSettingsRef.current.selectedModel ||
            reasoningEffort !== initialEditSettingsRef.current.reasoningEffort ||
            haveToolsChanged

        const uploadFile = useCallback(
            async (
                file: File,
                onProgress: (progress: number) => void,
                onReservationCreated: (key: string) => void,
                signal: AbortSignal
            ): Promise<UploadedFile> => {
                const jwt = await resolveJwtToken(token)
                if (!jwt) {
                    throw new Error("Authentication token unavailable")
                }

                return uploadChatAttachment({
                    file,
                    jwt,
                    uploadUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
                    policyVersion,
                    onProgress,
                    onPolicyVersionMismatch: invalidateUploadPolicy,
                    onReservationCreated,
                    signal
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

                const pendingFiles = files.map<EditUploadingFile>((file) => {
                    const { isImage } = getFileTypeInfo(file.name, file.type)
                    return {
                        id: crypto.randomUUID(),
                        file,
                        displayName: file.name,
                        tileKind: isDocumentExtension(file.name) ? "large-paste" : "attachment",
                        progress: 0,
                        status: "uploading",
                        previewUrl: isImage ? URL.createObjectURL(file) : undefined
                    }
                })

                setUploading(true)
                setUploadingFiles((current) => [...current, ...pendingFiles])
                const abortController = new AbortController()
                activeUploadControllersRef.current.add(abortController)
                const uploaded: UploadedFile[] = []
                const reservedKeys = new Set<string>()
                let activeFileId: string | undefined
                try {
                    for (const pendingFile of pendingFiles) {
                        abortController.signal.throwIfAborted()
                        activeFileId = pendingFile.id
                        const ingested = await ingestChatAttachment(pendingFile.file, {
                            canReferenceLongTextAttachments:
                                modelSupportsFunctionCalling && codeExecutionAvailable
                        })
                        abortController.signal.throwIfAborted()
                        setUploadingFiles((current) =>
                            current.map((file) =>
                                file.id === pendingFile.id
                                    ? { ...file, displayName: ingested.displayName }
                                    : file
                            )
                        )
                        if (ingested.decision) {
                            const nextEnabledTools = getEnabledToolsForPastedText(
                                ingested.decision,
                                enabledTools
                            )
                            if (nextEnabledTools !== enabledTools) {
                                setEnabledTools(nextEnabledTools)
                            }
                        }

                        if (ingested.delivery === "inline") {
                            uploaded.push(createInlineIngestedFile(ingested))
                            setUploadingFiles((current) =>
                                current.map((file) =>
                                    file.id === pendingFile.id
                                        ? { ...file, progress: 100, status: "success" }
                                        : file
                                )
                            )
                            continue
                        }

                        const uploadableFile = await prepareChatAttachmentForUpload(
                            ingested.file,
                            uploadPolicy
                        )
                        abortController.signal.throwIfAborted()
                        uploaded.push(
                            finalizeIngestedUpload(
                                await uploadFile(
                                    uploadableFile,
                                    (progress) => {
                                        setUploadingFiles((current) =>
                                            current.map((file) =>
                                                file.id === pendingFile.id
                                                    ? { ...file, progress }
                                                    : file
                                            )
                                        )
                                    },
                                    (key) => reservedKeys.add(key),
                                    abortController.signal
                                ),
                                ingested
                            )
                        )
                        abortController.signal.throwIfAborted()
                        setUploadingFiles((current) =>
                            current.map((file) =>
                                file.id === pendingFile.id
                                    ? { ...file, progress: 100, status: "success" }
                                    : file
                            )
                        )
                    }
                    await new Promise((resolve) => setTimeout(resolve, 500))
                    abortController.signal.throwIfAborted()
                    setUploadingFiles((current) =>
                        current.map((file) =>
                            pendingFiles.some((pending) => pending.id === file.id)
                                ? { ...file, status: "ready" }
                                : file
                        )
                    )
                    await new Promise((resolve) => setTimeout(resolve, 200))
                    abortController.signal.throwIfAborted()
                    setAddedFiles((current) => [...current, ...uploaded])
                    setUploadingFiles((current) =>
                        current.filter(
                            (file) => !pendingFiles.some((pending) => pending.id === file.id)
                        )
                    )
                    for (const file of pendingFiles) {
                        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
                    }
                } catch (error) {
                    const storedKeys = new Set([
                        ...reservedKeys,
                        ...uploaded.filter((file) => !file.inlineDataUrl).map((file) => file.key)
                    ])

                    if (abortController.signal.aborted) {
                        void Promise.allSettled(
                            [...storedKeys].map((key) => deleteFileMutation({ key }))
                        )
                        setUploadingFiles((current) =>
                            current.filter(
                                (file) => !pendingFiles.some((pending) => pending.id === file.id)
                            )
                        )
                        for (const file of pendingFiles) {
                            if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
                        }
                        return
                    }

                    const errorMessage = error instanceof Error ? error.message : "Upload failed"
                    setUploadingFiles((current) =>
                        current.map((file) =>
                            file.id === activeFileId
                                ? { ...file, status: "error", error: errorMessage }
                                : file
                        )
                    )
                    await Promise.allSettled(
                        [...storedKeys].map((key) => deleteFileMutation({ key }))
                    )
                    toast.error(errorMessage)
                    setTimeout(() => {
                        setUploadingFiles((current) =>
                            current.filter(
                                (file) => !pendingFiles.some((pending) => pending.id === file.id)
                            )
                        )
                        for (const file of pendingFiles) {
                            if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
                        }
                    }, 2000)
                } finally {
                    activeUploadControllersRef.current.delete(abortController)
                    setUploading(false)
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                    }
                }
            },
            [
                codeExecutionAvailable,
                deleteFileMutation,
                enabledTools,
                modelSupportsFunctionCalling,
                modelSupportsNativePdf,
                modelSupportsVision,
                setEnabledTools,
                uploadFile,
                uploadPolicy,
                uploading
            ]
        )

        const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            if (event.target.files) {
                void handleAddFiles(Array.from(event.target.files))
            }
        }

        const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const files = Array.from(event.clipboardData.items)
                .filter((item) => item.kind === "file")
                .map((item) => item.getAsFile())
                .filter((file): file is File => file !== null)

            if (files.length === 0) return

            event.preventDefault()
            void handleAddFiles(files)
        }

        const removeAddedFile = (file: UploadedFile) => {
            setAddedFiles((current) => current.filter((addedFile) => addedFile.key !== file.key))
            if (file.inlineDataUrl) {
                toast.success("Attachment deleted")
                return
            }

            deleteFileMutation({ key: file.key })
                .then((result) => {
                    if (result.success) {
                        toast.success("Attachment deleted")
                    } else if (result.error === "File not found") {
                        toast.info("Attachment was already deleted")
                    } else {
                        toast.error(result.error || "Failed to delete attachment")
                    }
                })
                .catch((error) => {
                    toast.error(
                        error instanceof Error ? error.message : "Failed to delete attachment"
                    )
                })
        }

        const handleSave = () => {
            const remainingFileParts = fileParts.filter((p) => !deletedUrls.includes(p.url))
            const addedFileParts = addedFiles.map(
                (file) =>
                    ({
                        type: "file",
                        url: file.inlineDataUrl ?? getPublicR2AssetUrl(file.key),
                        mediaType: getAttachmentTileMediaType(file.fileType, file.tileKind),
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
            const storedFiles = addedFiles.filter((file) => !file.inlineDataUrl)
            if (storedFiles.length === 0) return

            void Promise.allSettled(
                storedFiles.map((file) => deleteFileMutation({ key: file.key }))
            ).then((results) => {
                let deletedCount = 0
                let alreadyDeletedCount = 0
                let failedCount = 0

                for (const result of results) {
                    if (result.status === "rejected") {
                        failedCount += 1
                    } else if (result.value?.success) {
                        deletedCount += 1
                    } else if (result.value?.error === "File not found") {
                        alreadyDeletedCount += 1
                    } else {
                        failedCount += 1
                    }
                }

                if (deletedCount > 0) {
                    toast.success(
                        deletedCount === 1
                            ? "Attachment deleted"
                            : `${deletedCount} attachments deleted`
                    )
                }
                if (alreadyDeletedCount > 0) {
                    toast.info(
                        alreadyDeletedCount === 1
                            ? "Attachment was already deleted"
                            : `${alreadyDeletedCount} attachments were already deleted`
                    )
                }
                if (failedCount > 0) {
                    toast.error(
                        failedCount === 1
                            ? "Failed to delete attachment"
                            : `Failed to delete ${failedCount} attachments`
                    )
                }
            })
        }, [addedFiles, deleteFileMutation])

        const restoreInitialEditSettings = useCallback(() => {
            const initialSettings = initialEditSettingsRef.current

            setSelectedModel(initialSettings.selectedModel)
            setEnabledTools(initialSettings.enabledTools)
            setReasoningEffort(initialSettings.reasoningEffort)
        }, [setEnabledTools, setReasoningEffort, setSelectedModel])

        const cancelActiveUploads = useCallback(() => {
            for (const controller of activeUploadControllersRef.current) {
                controller.abort()
            }
        }, [])

        const commitCancel = useCallback(() => {
            cancelActiveUploads()
            if (addedFiles.length > 0) {
                discardAddedFiles()
            }
            restoreInitialEditSettings()
            onCancel()
        }, [
            addedFiles.length,
            cancelActiveUploads,
            discardAddedFiles,
            onCancel,
            restoreInitialEditSettings
        ])

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

        useEffect(() => cancelActiveUploads, [cancelActiveUploads])

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

        const totalAttachmentCount = fileParts.length + addedFiles.length + uploadingFiles.length

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
                        onPaste={handlePaste}
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
                                const tileKind = getAttachmentTileKind(part.mediaType)
                                const actionLabel = isRemoved
                                    ? "Restore attachment"
                                    : "Remove attachment from message"

                                const handleToggleRemove = () => {
                                    setDeletedUrls((prev) =>
                                        prev.includes(part.url)
                                            ? prev.filter((url) => url !== part.url)
                                            : [...prev, part.url]
                                    )
                                }

                                return (
                                    <div key={index} className="group relative shrink-0">
                                        {isImage ? (
                                            <div
                                                className={cn(
                                                    "flex items-center justify-center overflow-hidden border-2 border-border bg-secondary/50",
                                                    isCompact
                                                        ? "h-12 w-12"
                                                        : "h-auto max-h-64 w-auto max-w-full",
                                                    isRemoved && "opacity-50 grayscale-[50%]"
                                                )}
                                                style={{ borderRadius: "var(--radius)" }}
                                            >
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
                                            </div>
                                        ) : (
                                            <AttachmentTile
                                                fileName={filename}
                                                kind={tileKind}
                                                icon={getFileIcon(part)}
                                                className={cn(
                                                    "h-12",
                                                    isRemoved && "opacity-50 grayscale-[50%]"
                                                )}
                                            />
                                        )}

                                        {isRemoved && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                                                <Trash2 className="size-5 text-destructive drop-shadow-md" />
                                            </div>
                                        )}

                                        <Tooltip delayDuration={150}>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    onClick={handleToggleRemove}
                                                    aria-label={actionLabel}
                                                    className={cn(
                                                        "absolute -top-2 -right-2 h-8 w-8 opacity-100 shadow-sm transition-opacity md:-top-1 md:-right-1 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100",
                                                        isRemoved
                                                            ? "bg-background/80 text-foreground"
                                                            : "bg-background/50 text-foreground hover:bg-destructive hover:text-destructive-foreground"
                                                    )}
                                                    style={{ borderRadius: "var(--radius-xl)" }}
                                                >
                                                    {isRemoved ? (
                                                        <RotateCcw className="size-4 md:size-3" />
                                                    ) : (
                                                        <X className="size-4 md:size-3" />
                                                    )}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>{actionLabel}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                )
                            })}

                            {uploadingFiles.map((file) => (
                                <div key={file.id} className="relative shrink-0">
                                    <AttachmentTile
                                        fileName={file.displayName}
                                        kind={file.tileKind}
                                        icon={
                                            file.tileKind === "large-paste" ? (
                                                <FileText className="size-4 text-primary" />
                                            ) : (
                                                getFileIcon({
                                                    url: "",
                                                    filename: file.file.name,
                                                    mediaType: file.file.type
                                                })
                                            )
                                        }
                                        status={file.status}
                                        progress={file.progress}
                                        error={file.error}
                                        previewUrl={file.previewUrl}
                                        className={cn(!file.previewUrl && "h-12")}
                                    />
                                </div>
                            ))}

                            {addedFiles.map((file) => {
                                const isImage = isImageMimeType(file.fileType)
                                const tileKind = file.tileKind ?? "attachment"
                                const publicUrl = getPublicR2AssetUrl(file.key)

                                return (
                                    <div key={file.key} className="group relative shrink-0">
                                        <AttachmentTile
                                            fileName={file.displayName ?? file.fileName}
                                            kind={tileKind}
                                            icon={getFileIcon({
                                                url: publicUrl,
                                                filename: file.fileName,
                                                mediaType: getAttachmentTileMediaType(
                                                    file.fileType,
                                                    tileKind
                                                )
                                            })}
                                            previewUrl={isImage ? publicUrl : undefined}
                                            className="h-12"
                                        />

                                        <Tooltip delayDuration={150}>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    onClick={() => removeAddedFile(file)}
                                                    aria-label="Remove attachment from message"
                                                    className="absolute -top-2 -right-2 h-8 w-8 bg-background/50 text-foreground opacity-100 shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground md:-top-1 md:-right-1 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100"
                                                    style={{ borderRadius: "var(--radius-xl)" }}
                                                >
                                                    <X className="size-4 md:size-3" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>Remove attachment from message</p>
                                            </TooltipContent>
                                        </Tooltip>
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
                                    telemetrySurface="message_edit"
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

const MESSAGE_VIRTUALIZER_BUFFER = 700
const MESSAGE_VIRTUALIZER_ITEM_SIZE = 208
const BOTTOM_SCROLL_THRESHOLD_PX = 4
const SCROLL_IDLE_DELAY_MS = 2_000
const ACCORDION_SCROLL_FOLLOW_PAUSE_MS = 200
const STREAMING_ANCHOR_TOP_GAP_PX = 16
const MESSAGE_MARKDOWN_CLASS =
    "prose relative max-w-none prose-pre:bg-transparent prose-pre:p-0 [font-weight:450] prose-headings:font-semibold prose-strong:font-medium prose-pre:text-foreground leading-7 [&_.ignore-pre-bg>div]:bg-transparent [&_pre>div]:border-0.5 [&_pre>div]:border-border [&_pre>div]:bg-background"
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
        deletedUrls?: string[]
    ) => void
    onCancelEdit: () => void
    onFilePreview: (part: PreviewFile) => void
    requiresNativePdfForModelSelection: boolean
    threadId?: string
    sharedThreadId?: string
    copyOnlyActions?: boolean
}

const MessageRowComponent = ({
    message,
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
    requiresNativePdfForModelSelection,
    threadId,
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
            part.type !== "tool-web_search"
        )
    })
    const fileParts = message.parts.filter((part) => part.type === "file")
    const cancelEditRequestRef = useRef<(() => void) | null>(null)
    const bubbleRef = useRef<HTMLDivElement>(null)
    const bubbleRectRef = useRef<{ width: number; height: number } | null>(null)
    const actionsRectRef = useRef<{ left: number; top: number } | null>(null)
    const actionsAnimationRef = useRef<Animation | null>(null)
    const prevIsEditingRef = useRef(isEditing)

    const captureCurrentBubbleLayout = useCallback(() => {
        const element = bubbleRef.current
        if (!element) return

        const rect = element.getBoundingClientRect()
        const actionsRect = element
            .querySelector<HTMLElement>("[data-message-actions]")
            ?.getBoundingClientRect()

        bubbleRectRef.current = { width: rect.width, height: rect.height }
        actionsRectRef.current = actionsRect
            ? { left: actionsRect.left, top: actionsRect.top }
            : null
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
        const actionsElement = element.querySelector<HTMLElement>("[data-message-actions]")
        const actionsRect = actionsElement?.getBoundingClientRect()
        const nextWidth = rect.width
        const nextHeight = rect.height
        const editingChanged = prevIsEditingRef.current !== isEditing
        const prevRect = bubbleRectRef.current
        const prevActionsRect = actionsRectRef.current

        bubbleRectRef.current = { width: nextWidth, height: nextHeight }
        actionsRectRef.current = actionsRect
            ? { left: actionsRect.left, top: actionsRect.top }
            : null
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

        const animationOptions = {
            duration: 300,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)"
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
            animationOptions
        )

        if (actionsElement && actionsRect && prevActionsRect) {
            actionsAnimationRef.current?.cancel()

            Object.assign(actionsElement.style, {
                position: "fixed",
                top: `${actionsRect.top}px`,
                right: "auto",
                left: `${actionsRect.left}px`,
                marginTop: "0"
            })

            const actionsAnimation = actionsElement.animate(
                [
                    {
                        transform: `translate(${prevActionsRect.left - actionsRect.left}px, ${prevActionsRect.top - actionsRect.top}px)`
                    },
                    { transform: "translate(0, 0)" }
                ],
                animationOptions
            )
            actionsAnimationRef.current = actionsAnimation

            void actionsAnimation.finished
                .then(() => {
                    if (actionsAnimationRef.current !== actionsAnimation) return

                    actionsAnimationRef.current = null
                    actionsElement.removeAttribute("style")
                })
                .catch(() => undefined)
        }
    })

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
                    message.role === "user" &&
                        !isEditing &&
                        "my-12 ml-auto w-fit max-w-[min(28rem,100%)] rounded-md border border-border bg-user-message px-4 py-2 text-user-message-foreground",
                    message.role === "user" && isEditing && "mt-12 ml-auto w-full"
                )}
            >
                {isEditing ? (
                    <EditableMessage
                        message={message}
                        onSave={onSaveEdit}
                        onCancel={onCancelEdit}
                        cancelRequestRef={cancelEditRequestRef}
                        requiresNativePdfForModelSelection={requiresNativePdfForModelSelection}
                    />
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

                            {groupedToolOrder.map((activity) =>
                                activity.type === "blocked-tools" ? (
                                    <BlockedToolCard
                                        key={`${message.id}-blocked-tools`}
                                        attempts={toolFailureAttempts}
                                        retryMessage={retryMessage}
                                        onRetry={onRetry}
                                        requiresNativePdf={requiresNativePdfForModelSelection}
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
                                        key={`${message.id}-web-searches`}
                                        searches={webSearches}
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
                                        ((message.metadata as { threadId?: string } | undefined)
                                            ?.threadId as string | undefined) ?? threadId
                                    }
                                    messageId={message.id}
                                    sharedThreadId={sharedThreadId}
                                    onFilePreview={onFilePreview}
                                    onSwitchModel={onSwitchModel}
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
                                        ((message.metadata as { threadId?: string } | undefined)
                                            ?.threadId as string | undefined) ?? threadId
                                    }
                                    messageId={message.id}
                                    sharedThreadId={sharedThreadId}
                                    onFilePreview={onFilePreview}
                                    isStreaming={isStreamingMessage}
                                    readOnly={copyOnlyActions}
                                />
                            </div>
                        ) : null}
                    </>
                )}

                {message.role === "user" && (!hasActiveTarget || isEditing) ? (
                    <ChatActions
                        role={message.role}
                        message={message}
                        onRetry={onRetry}
                        onEdit={handleStartEdit}
                        editing={isEditing}
                        onCancelEdit={() => cancelEditRequestRef.current?.()}
                        requiresNativePdfForModelSelection={requiresNativePdfForModelSelection}
                        copyOnly={copyOnlyActions}
                    />
                ) : !hasActiveTarget && message.role === "assistant" && !isStreamingMessage ? (
                    <ChatActions
                        role={message.role}
                        message={message}
                        onRetry={undefined}
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
    previousProps.requiresNativePdfForModelSelection ===
        nextProps.requiresNativePdfForModelSelection &&
    previousProps.sharedThreadId === nextProps.sharedThreadId &&
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
            deletedUrls?: string[]
        ) => void
        onQuoteSelection?: (selection: string) => void
        status: ReturnType<typeof useChatIntegration>["status"]
        error?: ReturnType<typeof useChatIntegration>["error"]
        onBottomStateChange?: (isAtBottom: boolean) => void
        onScrollDirectionChange?: (direction: MessageScrollDirection) => void
        threadKey?: string
        threadId?: string
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
                setTargetFromMessageId(message.id)
                setTargetMode("edit")
            },
            [setTargetFromMessageId, setTargetMode]
        )

        const handleSaveEdit = useCallback(
            (newContent: string, remainingFileParts?: FileUIPart[], deletedUrls?: string[]) => {
                if (targetFromMessageId && onEditAndRetryRef.current) {
                    onEditAndRetryRef.current(
                        targetFromMessageId,
                        newContent,
                        remainingFileParts,
                        deletedUrls
                    )
                }
                setTargetFromMessageId(undefined)
                setTargetMode("normal")
            },
            [setTargetFromMessageId, setTargetMode, targetFromMessageId]
        )

        const handleCancelEdit = useCallback(() => {
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

        const renderedMessageRows = messageRows.map((row) => (
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
                retryMessage={row.retryMessage}
                onRetry={onRetry ? stableOnRetry : undefined}
                onSwitchModel={copyOnlyActions ? undefined : handleSwitchModel}
                onBranch={onBranch ? stableOnBranch : undefined}
                onEdit={copyOnlyActions ? undefined : handleEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onFilePreview={handleFilePreview}
                requiresNativePdfForModelSelection={threadHasPdfAttachments}
                threadId={threadId}
                sharedThreadId={sharedThreadId}
                copyOnlyActions={copyOnlyActions}
            />
        ))
        const virtualizedMessageRows = renderedMessageRows.slice(0, virtualizedMessageCount)
        const directMessageRows = renderedMessageRows.slice(virtualizedMessageCount)

        useLayoutEffect(() => {
            void messages.length
            void lastMessage?.id
            void status

            if (!shouldStickToBottomRef.current) {
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
