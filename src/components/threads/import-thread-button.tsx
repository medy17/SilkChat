import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useToken } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { uploadFileDirect } from "@/lib/direct-upload"
import { MAX_ATTACHMENTS_PER_THREAD, getFileTypeInfo } from "@/lib/file_constants"
import { isImportedPdf, PDF_IMPORT_ERROR } from "@/lib/import-attachment-policy"
import type { ParsedThreadImportDocument } from "@/lib/thread-import"
import {
    fetchRemoteAttachmentAsFile,
    mergeChatGPTExporterCompanionMarkdown,
    parseThreadImportContents,
    prepareImportedAttachmentFile
} from "@/lib/thread-import"
import { dispatchThreadImportDialogState } from "@/lib/thread-import-events"
import { buildThreadImportDocumentKey } from "@/lib/thread-import-keys"
import {
    type AttachmentImportMode,
    type ImportOutcome,
    type ImportRow,
    countImportOutcomes,
    getImportRowIssue,
    getImportRowOutcome,
    getImportSelectionState,
    groupImportRowsByFile,
    isImportRowSelectable,
    summarizeImportQueue
} from "@/lib/thread-import-presentation"
import { useMutation, useQuery } from "convex/react"
import { CircleAlert, Clock3, FileText, FileUp, Loader2, Check } from "lucide-react"
import { nanoid } from "nanoid"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    ImportConversationRow,
    ImportDropVeil,
    ImportEmptyState,
    ImportFileGroupRows,
    ImportListHeader,
    ImportOutcomeFilter,
    ImportSettingsRow,
    NO_FOLDER,
    shouldShowOutcomeFilter
} from "./import-thread-list"
import { NewFolderDialog } from "./new-folder-button"
import type { Project } from "./types"

type ImportMutationMessage = {
    role: "user" | "assistant" | "system"
    createdAt?: number
    parts: Array<
        | {
              type: "text"
              text: string
          }
        | {
              type: "file"
              data: string
              filename?: string
              mimeType?: string
          }
    >
    metadata?: {
        modelName?: string
    }
}

interface ImportSourceFile {
    id: string
    file: File
}

interface ImportQueueItem extends ImportRow {
    documentKey: string
    supportingSourceIds?: string[]
    parsed?: ParsedThreadImportDocument
    threadId?: Id<"threads">
    importedAttachmentCount?: number
}

const supportedImportExtensionRegex = /\.(md|markdown|txt|json)$/i
const importConcurrencyTargets = {
    mirrorStandard: 6,
    externalLinks: 16,
    skipAttachments: 10,
    attachmentHeavy: 5,
    attachmentVeryHeavy: 4,
    globalAttachmentPool: 8
} as const
const attachmentThrottleThresholds = {
    high: 160,
    medium: 80
} as const

type TaskRunner = <T>(task: () => Promise<T>) => Promise<T>

/** Over this many conversations, or when copying attachments, imports run as a background job. */
const BACKGROUND_IMPORT_THRESHOLD = 50
/** Files with up to this many conversations, or with issues, start expanded. */
const AUTO_EXPAND_LIMIT = 6

const documentHasPdf = (document: ParsedThreadImportDocument) =>
    document.messages.some((message) => message.attachments.some(isImportedPdf))

const countDocumentAttachments = (document: ParsedThreadImportDocument) =>
    document.messages.reduce((sum, message) => sum + message.attachments.length, 0)

const inferAttachmentMimeType = (filename: string) => {
    const fileTypeInfo = getFileTypeInfo(filename)

    if (fileTypeInfo.isPdf) {
        return "application/pdf"
    }

    if (fileTypeInfo.isImage) {
        const extension = fileTypeInfo.extension

        switch (extension) {
            case ".png":
                return "image/png"
            case ".jpg":
            case ".jpeg":
                return "image/jpeg"
            case ".gif":
                return "image/gif"
            case ".webp":
                return "image/webp"
            case ".bmp":
                return "image/bmp"
            case ".ico":
                return "image/x-icon"
            case ".svg":
                return "image/svg+xml"
            default:
                return undefined
        }
    }

    if (fileTypeInfo.isText) {
        return "text/plain"
    }

    return undefined
}

const createTaskRunner = (concurrency: number): TaskRunner => {
    if (concurrency <= 1) {
        return async function runTask<T>(task: () => Promise<T>) {
            return task()
        }
    }

    let activeTasks = 0
    const pendingTasks: Array<() => void> = []

    const runNextTask = () => {
        if (activeTasks >= concurrency) {
            return
        }

        const nextTask = pendingTasks.shift()
        if (!nextTask) {
            return
        }

        activeTasks += 1
        nextTask()
    }

    return function runTask<T>(task: () => Promise<T>) {
        return new Promise<T>((resolve, reject) => {
            const executeTask = () => {
                void task()
                    .then(resolve, reject)
                    .finally(() => {
                        activeTasks -= 1
                        runNextTask()
                    })
            }

            pendingTasks.push(executeTask)
            runNextTask()
        })
    }
}

const uploadAttachment = async ({ file, jwt }: { file: File; jwt: string }) => {
    return uploadFileDirect({
        file,
        jwt,
        uploadBaseUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
        purpose: "attachment"
    })
}

const uploadImportSource = async ({
    file,
    clientSourceId,
    jwt
}: {
    file: File
    clientSourceId: string
    jwt: string
}) => {
    const uploaded = await uploadFileDirect({
        file,
        jwt,
        uploadBaseUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
        purpose: "import-source"
    })
    return {
        clientSourceId,
        storageKey: uploaded.key,
        fileName: uploaded.fileName,
        mimeType: uploaded.fileType,
        size: uploaded.fileSize
    }
}

export function ImportThreadButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            className="h-9 w-full justify-start gap-2 px-2 font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            style={{ borderRadius: "var(--radius-lg)" }}
        >
            <FileUp className="size-4 shrink-0" />
            <span>Import Thread</span>
        </Button>
    )
}

export function ImportThreadDialog({
    open,
    onOpenChange,
    projects,
    jobId,
    onJobIdChange,
    onImported
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    projects: Project[]
    jobId: Id<"importJobs"> | null
    onJobIdChange: (jobId: Id<"importJobs"> | null) => void
    onImported?: (threadId: Id<"threads">) => void
}) {
    const { token } = useToken()
    const isMobile = useIsMobile()
    const importThreadMutation = useMutation(api.threads.importThread)
    const startImportJobMutation = useMutation(api.import_jobs.startImportJob)
    const deleteImportJobMutation = useMutation(api.import_jobs.deleteImportJob)
    const currentJob = useQuery(api.import_jobs.getImportJob, jobId ? { jobId } : "skip")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dragDepthRef = useRef(0)

    const setOpen = onOpenChange
    const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
    const [sourceFiles, setSourceFiles] = useState<ImportSourceFile[]>([])
    const [queue, setQueue] = useState<ImportQueueItem[]>([])
    const [isParsingFiles, setIsParsingFiles] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isDropZoneActive, setIsDropZoneActive] = useState(false)
    const [attachmentImportMode, setAttachmentImportMode] =
        useState<AttachmentImportMode>("external")
    const [selectedProjectId, setSelectedProjectId] = useState<string>(NO_FOLDER)
    const [outcomeFilter, setOutcomeFilter] = useState<ImportOutcome | "all">("all")
    const [toggledGroups, setToggledGroups] = useState<Set<string>>(new Set())

    useEffect(() => {
        dispatchThreadImportDialogState(open)
    }, [open])

    useEffect(() => {
        return () => {
            dispatchThreadImportDialogState(false)
        }
    }, [])

    useEffect(() => {
        if (!open) {
            dragDepthRef.current = 0
            setIsDropZoneActive(false)
        }
    }, [open])

    const resetLocalImportState = () => {
        setQueue([])
        setSourceFiles([])
        setIsParsingFiles(false)
        setIsImporting(false)
        setOutcomeFilter("all")
        setToggledGroups(new Set())
        dragDepthRef.current = 0
        setIsDropZoneActive(false)
    }

    const itemsReadyForImport = useMemo(
        () =>
            queue.filter(
                (item) =>
                    item.selected &&
                    item.parsed &&
                    isImportRowSelectable(item, attachmentImportMode)
            ),
        [queue, attachmentImportMode]
    )

    const selectedAttachmentCount = useMemo(
        () => itemsReadyForImport.reduce((sum, item) => sum + item.attachmentCount, 0),
        [itemsReadyForImport]
    )

    const shouldMirrorAttachments = attachmentImportMode === "mirror"
    const shouldKeepExternalAttachments = attachmentImportMode === "external"
    const shouldUseAsyncImport =
        shouldMirrorAttachments ||
        itemsReadyForImport.length > BACKGROUND_IMPORT_THRESHOLD ||
        Boolean(jobId)

    const requestedConcurrency = useMemo(() => {
        switch (attachmentImportMode) {
            case "mirror":
                return importConcurrencyTargets.mirrorStandard
            case "external":
                return importConcurrencyTargets.externalLinks
            case "skip":
                return importConcurrencyTargets.skipAttachments
        }
    }, [attachmentImportMode])

    const effectiveConcurrency = useMemo(() => {
        if (!shouldMirrorAttachments) {
            return requestedConcurrency
        }

        if (selectedAttachmentCount >= attachmentThrottleThresholds.high) {
            return importConcurrencyTargets.attachmentVeryHeavy
        }

        if (selectedAttachmentCount >= attachmentThrottleThresholds.medium) {
            return Math.min(requestedConcurrency, importConcurrencyTargets.attachmentHeavy)
        }

        return requestedConcurrency
    }, [shouldMirrorAttachments, requestedConcurrency, selectedAttachmentCount])

    const queueSummary = useMemo(
        () => summarizeImportQueue(queue, attachmentImportMode, isImporting),
        [queue, attachmentImportMode, isImporting]
    )

    const updateQueueItem = (id: string, updater: (item: ImportQueueItem) => ImportQueueItem) => {
        setQueue((previous) => previous.map((item) => (item.id === id ? updater(item) : item)))
    }

    const mergePairedChatGPTExporterQueueItems = (items: ImportQueueItem[]) => {
        const jsonByConversationId = new Map<string, ImportQueueItem[]>()
        const markdownByConversationId = new Map<string, ImportQueueItem[]>()

        for (const item of items) {
            if (item.status !== "ready" || !item.parsed) continue
            if (item.parsed.source.service !== "chatgptexporter") continue

            const conversationId = item.parsed.source.conversationId
            if (!conversationId) continue

            if (item.parsed.source.format === "json") {
                const existing = jsonByConversationId.get(conversationId) ?? []
                existing.push(item)
                jsonByConversationId.set(conversationId, existing)
            }

            if (item.parsed.source.format === "markdown") {
                const existing = markdownByConversationId.get(conversationId) ?? []
                existing.push(item)
                markdownByConversationId.set(conversationId, existing)
            }
        }

        const updateById = new Map<string, ImportQueueItem>()
        const removeIds = new Set<string>()

        for (const [conversationId, jsonItems] of jsonByConversationId.entries()) {
            const markdownItems = markdownByConversationId.get(conversationId)
            if (!markdownItems?.length) continue

            const mergePairs = Math.min(jsonItems.length, markdownItems.length)
            for (let index = 0; index < mergePairs; index += 1) {
                const jsonItem = jsonItems[index]
                const markdownItem = markdownItems[index]
                if (!jsonItem.parsed || !markdownItem.parsed) continue

                const mergeResult = mergeChatGPTExporterCompanionMarkdown({
                    jsonDocument: jsonItem.parsed,
                    markdownDocument: markdownItem.parsed
                })

                if (!mergeResult.merged) {
                    continue
                }

                removeIds.add(markdownItem.id)

                const enrichmentWarning = mergeResult.mergedDocument.parseWarnings.find((warning) =>
                    warning.startsWith("Enriched from markdown companion")
                )

                const hasPdf = documentHasPdf(mergeResult.mergedDocument)
                updateById.set(jsonItem.id, {
                    ...jsonItem,
                    pairedFileName: markdownItem.sourceFileName,
                    hasPdf,
                    selected: jsonItem.selected && !hasPdf,
                    supportingSourceIds: Array.from(
                        new Set([
                            ...(jsonItem.supportingSourceIds ?? []),
                            jsonItem.sourceId,
                            ...(markdownItem.supportingSourceIds ?? []),
                            markdownItem.sourceId
                        ])
                    ).filter((sourceId) => sourceId !== jsonItem.sourceId),
                    parsed: mergeResult.mergedDocument,
                    messageCount: mergeResult.mergedDocument.messages.length,
                    attachmentCount: countDocumentAttachments(mergeResult.mergedDocument),
                    parseWarning:
                        enrichmentWarning ||
                        mergeResult.mergedDocument.parseWarnings[0] ||
                        undefined
                })
            }
        }

        const queue = items
            .filter((item) => !removeIds.has(item.id))
            .map((item) => updateById.get(item.id) ?? item)

        return queue
    }

    const sanitizeIncomingFiles = (files: File[]) => {
        const accepted: File[] = []
        let rejected = 0

        for (const file of files) {
            const matchesByType =
                file.type === "text/markdown" ||
                file.type === "text/plain" ||
                file.type === "application/markdown" ||
                file.type === "application/json"

            const matchesByName = supportedImportExtensionRegex.test(file.name)

            if (matchesByType || matchesByName) {
                accepted.push(file)
            } else {
                rejected += 1
            }
        }

        return {
            accepted,
            rejected
        }
    }

    const handleAddFiles = async (files: File[]) => {
        if (files.length === 0) {
            return
        }

        const { accepted, rejected } = sanitizeIncomingFiles(files)

        if (rejected > 0) {
            toast.error(
                `Skipped ${rejected} file${rejected > 1 ? "s" : ""}. Use supported exports (.md, .txt, .json).`
            )
        }

        if (accepted.length === 0) {
            return
        }

        const acceptedSourceFiles: ImportSourceFile[] = accepted.map((file) => ({
            id: nanoid(),
            file
        }))
        const queuedItems: ImportQueueItem[] = acceptedSourceFiles.map((source) => ({
            id: nanoid(),
            sourceId: source.id,
            documentKey: source.id,
            supportingSourceIds: [],
            sourceFileName: source.file.name,
            title: source.file.name,
            selected: true,
            status: "parsing",
            messageCount: 0,
            attachmentCount: 0
        }))

        setSourceFiles((previous) => [...previous, ...acceptedSourceFiles])
        setQueue((previous) => [...previous, ...queuedItems])
        setIsParsingFiles(true)

        await Promise.all(
            queuedItems.map(async (queuedItem, index) => {
                const source = acceptedSourceFiles[index]
                const file = source.file

                try {
                    const content = await file.text()
                    const parsedDocuments = parseThreadImportContents({
                        content,
                        fileName: file.name,
                        mimeType: file.type || undefined
                    })

                    const importableDocuments = parsedDocuments.filter(
                        (document) => document.messages.length > 0
                    )

                    if (importableDocuments.length === 0) {
                        updateQueueItem(queuedItem.id, (item) => ({
                            ...item,
                            selected: false,
                            status: "invalid",
                            error: "No importable messages found"
                        }))
                        return
                    }

                    const [firstDocument, ...remainingDocuments] = importableDocuments
                    const firstHasPdf = documentHasPdf(firstDocument)

                    // PDFs are caught here so those conversations can't be selected, rather
                    // than failing after Import. importSingleQueueItem still checks as a backstop.
                    updateQueueItem(queuedItem.id, (item) => ({
                        ...item,
                        documentKey: buildThreadImportDocumentKey(firstDocument, 0),
                        supportingSourceIds: [],
                        title: firstDocument.title,
                        selected: !firstHasPdf,
                        status: "ready",
                        parsed: firstDocument,
                        messageCount: firstDocument.messages.length,
                        attachmentCount: countDocumentAttachments(firstDocument),
                        hasPdf: firstHasPdf,
                        parseWarning: firstDocument.parseWarnings[0],
                        error: undefined
                    }))

                    if (remainingDocuments.length > 0) {
                        const extraItems: ImportQueueItem[] = remainingDocuments.map(
                            (document, documentIndex) => {
                                const hasPdf = documentHasPdf(document)
                                return {
                                    id: nanoid(),
                                    sourceId: source.id,
                                    documentKey: buildThreadImportDocumentKey(
                                        document,
                                        documentIndex + 1
                                    ),
                                    supportingSourceIds: [],
                                    sourceFileName: file.name,
                                    title: document.title,
                                    selected: !hasPdf,
                                    status: "ready",
                                    parsed: document,
                                    messageCount: document.messages.length,
                                    attachmentCount: countDocumentAttachments(document),
                                    hasPdf,
                                    parseWarning: document.parseWarnings[0]
                                }
                            }
                        )

                        setQueue((previous) => [...previous, ...extraItems])
                    }
                } catch (error) {
                    updateQueueItem(queuedItem.id, (item) => ({
                        ...item,
                        selected: false,
                        status: "invalid",
                        error:
                            error instanceof Error ? error.message : "Unable to parse import file"
                    }))
                }
            })
        )

        setQueue(mergePairedChatGPTExporterQueueItems)

        setIsParsingFiles(false)
    }

    const handleDialogDragEnter = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()

        if (!open || jobId || isImporting || isParsingFiles) {
            return
        }

        if (!event.dataTransfer?.types.includes("Files")) {
            return
        }

        dragDepthRef.current += 1
        setIsDropZoneActive(true)
    }

    const handleDialogDragLeave = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()

        dragDepthRef.current -= 1
        if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0
            setIsDropZoneActive(false)
        }
    }

    const handleDialogDragOver = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()
    }

    const handleDialogDrop = async (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()

        dragDepthRef.current = 0
        setIsDropZoneActive(false)

        if (jobId || isImporting || isParsingFiles) {
            return
        }

        const files = Array.from(event.dataTransfer.files || [])
        await handleAddFiles(files)
    }

    const importSingleQueueItem = async ({
        item,
        jwt,
        runAttachmentTask
    }: {
        item: ImportQueueItem
        jwt: string
        runAttachmentTask: TaskRunner
    }) => {
        if (!item.parsed) {
            throw new Error("Missing parsed conversation data")
        }

        // Check the source before skip mode removes its attachment references.
        if (item.parsed.messages.some((message) => message.attachments.some(isImportedPdf))) {
            throw new Error(PDF_IMPORT_ERROR)
        }

        let importedAttachmentCount = 0
        let failedAttachmentCount = 0
        let remainingAttachmentSlots = shouldMirrorAttachments
            ? MAX_ATTACHMENTS_PER_THREAD
            : Number.POSITIVE_INFINITY
        const preparedMessages: ImportMutationMessage[] = []

        for (const parsedMessage of item.parsed.messages) {
            const parts: ImportMutationMessage["parts"] = []

            const text = parsedMessage.text.trim()
            if (text) {
                parts.push({
                    type: "text",
                    text
                })
            }

            if (shouldMirrorAttachments) {
                const attachmentsToProcess = parsedMessage.attachments.slice(
                    0,
                    remainingAttachmentSlots
                )
                const skippedAttachments =
                    parsedMessage.attachments.length - attachmentsToProcess.length

                failedAttachmentCount += skippedAttachments

                const attachmentResults = await Promise.all(
                    attachmentsToProcess.map((attachment) =>
                        runAttachmentTask(async () => {
                            try {
                                const downloadedFile = await fetchRemoteAttachmentAsFile({
                                    url: attachment.url,
                                    filename: attachment.filename
                                })

                                const preparedFile =
                                    await prepareImportedAttachmentFile(downloadedFile)
                                const uploaded = await uploadAttachment({
                                    file: preparedFile,
                                    jwt
                                })

                                return {
                                    success: true as const,
                                    part: {
                                        type: "file" as const,
                                        data: uploaded.key,
                                        filename: uploaded.fileName,
                                        mimeType: uploaded.fileType
                                    }
                                }
                            } catch (error) {
                                console.warn(
                                    `[thread-import] Failed attachment import for ${attachment.url}`,
                                    error
                                )

                                return {
                                    success: false as const
                                }
                            }
                        })
                    )
                )

                for (const result of attachmentResults) {
                    if (!result.success) {
                        failedAttachmentCount += 1
                        continue
                    }

                    parts.push(result.part)
                    importedAttachmentCount += 1
                    remainingAttachmentSlots -= 1
                }
            } else if (shouldKeepExternalAttachments) {
                for (const attachment of parsedMessage.attachments) {
                    parts.push({
                        type: "file",
                        data: attachment.url,
                        filename: attachment.filename,
                        mimeType: inferAttachmentMimeType(attachment.filename)
                    })
                    importedAttachmentCount += 1
                }
            }

            if (parts.length > 0) {
                preparedMessages.push({
                    role: parsedMessage.role,
                    createdAt: parsedMessage.createdAt,
                    parts,
                    metadata: parsedMessage.metadata
                })
            }
        }

        if (preparedMessages.length === 0) {
            throw new Error("No messages left after validation and attachment processing")
        }

        const projectId =
            selectedProjectId === "no-folder" ? undefined : (selectedProjectId as Id<"projects">)

        const result = await importThreadMutation({
            title: item.parsed.title,
            messages: preparedMessages,
            projectId,
            sourceCreatedAt: item.parsed.source.createdAt,
            sourceUpdatedAt: item.parsed.source.updatedAt,
            personaSnapshot: item.parsed.personaSnapshot
        })

        if (!result || "error" in result) {
            const errorMessage =
                result && "error" in result && typeof result.error === "string"
                    ? result.error
                    : "Import failed"
            throw new Error(errorMessage)
        }

        return {
            threadId: result.threadId as Id<"threads">,
            importedMessages: preparedMessages.length,
            importedAttachmentCount,
            failedAttachmentCount
        }
    }

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || [])
        await handleAddFiles(files)
        event.target.value = ""
    }

    const handleImport = async () => {
        if (itemsReadyForImport.length === 0) return

        setIsImporting(true)
        try {
            const projectId =
                selectedProjectId === "no-folder"
                    ? undefined
                    : (selectedProjectId as Id<"projects">)

            if (shouldUseAsyncImport) {
                const jwt = await resolveJwtToken(token)
                if (!jwt) {
                    throw new Error("Authentication token unavailable")
                }

                const selectedDocumentKeysBySource = new Map<string, string[]>()
                for (const item of itemsReadyForImport) {
                    const keys = selectedDocumentKeysBySource.get(item.sourceId) ?? []
                    keys.push(item.documentKey)
                    selectedDocumentKeysBySource.set(item.sourceId, keys)

                    for (const supportingSourceId of item.supportingSourceIds ?? []) {
                        if (!selectedDocumentKeysBySource.has(supportingSourceId)) {
                            selectedDocumentKeysBySource.set(supportingSourceId, [])
                        }
                    }
                }

                const runUploadTask = createTaskRunner(8)
                const uploadedSources = await Promise.all(
                    Array.from(selectedDocumentKeysBySource.entries()).map(
                        ([sourceId, selectedDocumentKeys]) =>
                            runUploadTask(async () => {
                                const sourceFile = sourceFiles.find(
                                    (source) => source.id === sourceId
                                )
                                if (!sourceFile) {
                                    throw new Error("Missing selected source file for async import")
                                }

                                const uploaded = await uploadImportSource({
                                    file: sourceFile.file,
                                    clientSourceId: sourceId,
                                    jwt
                                })

                                return {
                                    clientSourceId: sourceId,
                                    storageKey: uploaded.storageKey,
                                    fileName: uploaded.fileName,
                                    mimeType: uploaded.mimeType,
                                    size: uploaded.size,
                                    selectedDocumentKeys
                                }
                            })
                    )
                )

                const result = await startImportJobMutation({
                    attachmentMode: attachmentImportMode,
                    projectId,
                    sourceFiles: uploadedSources
                })

                if (!result || "error" in result) {
                    throw new Error(
                        result && "error" in result && typeof result.error === "string"
                            ? result.error
                            : "Failed to start import job"
                    )
                }

                resetLocalImportState()
                onJobIdChange(result.jobId)
                return
            }

            const jwt = shouldMirrorAttachments ? await resolveJwtToken(token) : null
            if (shouldMirrorAttachments && !jwt) {
                throw new Error("Authentication token unavailable")
            }

            const importQueue = [...itemsReadyForImport]
            let cursor = 0
            const workerCount = Math.min(effectiveConcurrency, importQueue.length)
            const runAttachmentTask = createTaskRunner(
                shouldMirrorAttachments ? importConcurrencyTargets.globalAttachmentPool : 1
            )

            const runWorker = async () => {
                while (true) {
                    const currentIndex = cursor
                    cursor += 1

                    if (currentIndex >= importQueue.length) {
                        return
                    }

                    const queueItem = importQueue[currentIndex]

                    updateQueueItem(queueItem.id, (item) => ({
                        ...item,
                        status: "importing",
                        error: undefined
                    }))

                    try {
                        const result = await importSingleQueueItem({
                            item: queueItem,
                            jwt: jwt!,
                            runAttachmentTask
                        })

                        updateQueueItem(queueItem.id, (item) => ({
                            ...item,
                            selected: false,
                            status: "success",
                            threadId: result.threadId,
                            messageCount: result.importedMessages,
                            importedAttachmentCount: result.importedAttachmentCount,
                            failedAttachmentCount: result.failedAttachmentCount,
                            error: undefined
                        }))
                    } catch (error) {
                        updateQueueItem(queueItem.id, (item) => ({
                            ...item,
                            status: "error",
                            error: error instanceof Error ? error.message : "Import failed"
                        }))
                    }
                }
            }

            await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
        } catch (error) {
            console.error("[thread-import] failed", error)
            toast.error(error instanceof Error ? error.message : "Failed to import thread")
        } finally {
            setIsImporting(false)
        }
    }

    const startNewImport = () => {
        onJobIdChange(null)
        resetLocalImportState()
    }

    const handleDeleteCurrentJob = async () => {
        if (!jobId) return

        try {
            const result = await deleteImportJobMutation({ jobId })
            if (!result || ("error" in result && result.error)) {
                throw new Error(
                    result && "error" in result && typeof result.error === "string"
                        ? result.error
                        : "Failed to remove import job"
                )
            }

            onJobIdChange(null)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to remove import job")
        }
    }

    const toggleGroup = (groupId: string) =>
        setToggledGroups((previous) => {
            const next = new Set(previous)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })

    const toggleQueueItems = (ids: Set<string>, selected: boolean) =>
        setQueue((previous) =>
            previous.map((item) =>
                ids.has(item.id) && isImportRowSelectable(item, attachmentImportMode)
                    ? { ...item, selected }
                    : item
            )
        )

    const browseFiles = () => fileInputRef.current?.click()
    const isBusy = isImporting || isParsingFiles
    const listClassName =
        "relative flex min-h-[15rem] flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border"
    const scrollClassName = "min-h-0 flex-1 overflow-y-auto py-1"

    const renderQueueList = () => {
        if (queue.length === 0) {
            return (
                <div className={listClassName}>
                    <ImportEmptyState
                        onBrowse={browseFiles}
                        disabled={isBusy}
                        isMobile={isMobile}
                    />
                    <ImportDropVeil active={isDropZoneActive} />
                </div>
            )
        }

        const counts = countImportOutcomes(queue, attachmentImportMode)
        const showFilter = shouldShowOutcomeFilter(queue.length, counts)
        const activeOutcome =
            showFilter && (outcomeFilter === "all" || counts[outcomeFilter] > 0)
                ? outcomeFilter
                : "all"
        const groups = groupImportRowsByFile(queue)
            .map((group) => ({
                ...group,
                rows:
                    activeOutcome === "all"
                        ? group.rows
                        : group.rows.filter(
                              (row) =>
                                  getImportRowOutcome(row, attachmentImportMode) === activeOutcome
                          )
            }))
            .filter((group) => group.rows.length > 0)
        const isExpanded = (group: (typeof groups)[number]) => {
            const byDefault =
                activeOutcome !== "all" ||
                group.rows.length <= AUTO_EXPAND_LIMIT ||
                group.rows.some(
                    (row) => getImportRowIssue(row, attachmentImportMode)?.tone === "destructive"
                )
            return toggledGroups.has(group.sourceId) ? !byDefault : byDefault
        }
        const { progress } = queueSummary

        const renderRow = (item: ImportQueueItem, inset = false) => (
            <ImportConversationRow
                key={item.id}
                row={item}
                mode={attachmentImportMode}
                locked={isBusy}
                inset={inset}
                onToggle={(selected) => toggleQueueItems(new Set([item.id]), selected)}
                onRemove={() =>
                    setQueue((previous) => previous.filter((current) => current.id !== item.id))
                }
                onOpen={
                    item.threadId && onImported
                        ? () => onImported(item.threadId as Id<"threads">)
                        : undefined
                }
            />
        )

        return (
            <div className={listClassName}>
                <ImportListHeader
                    selection={getImportSelectionState(queue, attachmentImportMode)}
                    onToggleAll={(selected) =>
                        toggleQueueItems(
                            getImportSelectionState(queue, attachmentImportMode).ids,
                            selected
                        )
                    }
                    locked={isBusy}
                    filter={
                        showFilter ? (
                            <ImportOutcomeFilter
                                value={activeOutcome}
                                onValueChange={setOutcomeFilter}
                                total={queue.length}
                                counts={counts}
                            />
                        ) : undefined
                    }
                    label={`${queue.length} ${queue.length === 1 ? "conversation" : "conversations"}`}
                    status={
                        progress ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                {progress.done} of {progress.total}
                            </>
                        ) : isParsingFiles ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                Reading
                            </>
                        ) : undefined
                    }
                    onAddFiles={browseFiles}
                    progress={progress ? progress.done / Math.max(progress.total, 1) : undefined}
                />
                <div className={scrollClassName}>
                    {groups.map((group) =>
                        group.rows.length === 1 && activeOutcome === "all" ? (
                            renderRow(group.rows[0])
                        ) : (
                            <ImportFileGroupRows
                                key={group.sourceId}
                                group={group}
                                mode={attachmentImportMode}
                                expanded={isExpanded(group)}
                                onToggleExpanded={() => toggleGroup(group.sourceId)}
                                selectable
                                locked={isBusy}
                                onToggleMany={toggleQueueItems}
                                onRemoveGroup={() =>
                                    setQueue((previous) =>
                                        previous.filter((item) => item.sourceId !== group.sourceId)
                                    )
                                }
                                renderRow={(row) => renderRow(row, true)}
                            />
                        )
                    )}
                </div>
                <ImportDropVeil active={isDropZoneActive} />
            </div>
        )
    }

    const renderJobList = () => {
        const job = currentJob ?? undefined
        const settled =
            job?.status === "completed" ||
            job?.status === "completed_with_errors" ||
            job?.status === "failed"
        const failuresBySource = new Map<string, ImportRow[]>()
        for (const failure of job?.failures ?? []) {
            const rows = failuresBySource.get(failure.sourceId) ?? []
            rows.push({
                id: failure._id,
                sourceId: failure.sourceId,
                sourceFileName: "",
                title: failure.title,
                selected: false,
                status: "error",
                messageCount: failure.messageCount,
                attachmentCount: failure.attachmentCount,
                error: failure.error ?? "Import failed",
                parseWarning: failure.warning
            })
            failuresBySource.set(failure.sourceId, rows)
        }
        const unlistedFailures = job ? job.failedThreads - (job.failures?.length ?? 0) : 0
        const hasSourceError = job?.sources.some((source) => source.status === "error")
        const jobError =
            job?.status === "failed" && !hasSourceError ? job.recentErrors.at(-1) : undefined

        return (
            <div className={listClassName}>
                <ImportListHeader
                    label={
                        !job
                            ? "Import"
                            : job.totalThreads > 0
                              ? `${job.totalThreads} conversations`
                              : `${job.totalSourceFiles} ${job.totalSourceFiles === 1 ? "file" : "files"}`
                    }
                    status={
                        !job ? (
                            <Loader2 className="size-3.5 animate-spin" aria-label="Loading" />
                        ) : job.status === "queued" || job.status === "preparing" ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                Reading {job.preparedSourceFiles} of {job.totalSourceFiles}
                            </>
                        ) : job.status === "importing" ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                {job.processedThreads} of {job.totalThreads}
                            </>
                        ) : job.status === "failed" ? (
                            <span className="text-destructive">Failed</span>
                        ) : job.failedThreads > 0 ? (
                            <span className="text-destructive">{job.failedThreads} failed</span>
                        ) : (
                            <>
                                <Check className="size-3.5" aria-hidden="true" />
                                All imported
                            </>
                        )
                    }
                    progress={
                        !job
                            ? undefined
                            : job.totalThreads > 0
                              ? job.processedThreads / job.totalThreads
                              : job.preparedSourceFiles / Math.max(job.totalSourceFiles, 1)
                    }
                    settled={settled}
                />
                <div className={scrollClassName}>
                    {jobError && (
                        <div className="flex items-start gap-3 px-3 py-2.5">
                            <span className="flex size-5 shrink-0 items-center justify-center">
                                <CircleAlert
                                    className="size-4 text-destructive"
                                    aria-hidden="true"
                                />
                            </span>
                            <p className="min-w-0 flex-1 text-destructive text-sm">{jobError}</p>
                        </div>
                    )}
                    {job?.sources.map((source) => {
                        const rows = failuresBySource.get(source._id) ?? []
                        return (
                            <ImportFileGroupRows
                                key={source._id}
                                group={{
                                    sourceId: source._id,
                                    fileName: source.fileName,
                                    rows: rows.map((row) => ({
                                        ...row,
                                        sourceFileName: source.fileName
                                    }))
                                }}
                                mode={job.attachmentMode}
                                expanded={!toggledGroups.has(source._id)}
                                onToggleExpanded={() => toggleGroup(source._id)}
                                selectable={false}
                                count={source.preparedDocumentCount}
                                error={source.error}
                                status={
                                    source.status === "error" ? (
                                        <CircleAlert
                                            className="size-4 text-destructive"
                                            aria-label="Failed"
                                        />
                                    ) : source.status === "queued" ? (
                                        settled ? (
                                            <Clock3
                                                className="size-3.5 text-muted-foreground"
                                                aria-label="Not read"
                                            />
                                        ) : (
                                            <Loader2
                                                className="size-4 animate-spin text-muted-foreground"
                                                aria-label="Reading"
                                            />
                                        )
                                    ) : settled && rows.length === 0 ? (
                                        <Check
                                            className="size-4 text-primary"
                                            aria-label="Imported"
                                        />
                                    ) : (
                                        <FileText
                                            className="size-4 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                    )
                                }
                                renderRow={(row) => (
                                    <ImportConversationRow
                                        key={row.id}
                                        row={row}
                                        mode={job.attachmentMode}
                                        selectable={false}
                                        inset
                                    />
                                )}
                            />
                        )
                    })}
                    {unlistedFailures > 0 && (
                        <p className="px-3 py-2 pl-11 text-muted-foreground text-xs">
                            {unlistedFailures} more failed
                        </p>
                    )}
                </div>
            </div>
        )
    }

    const finished =
        !isImporting &&
        queueSummary.imported > 0 &&
        queueSummary.toImport === 0 &&
        queueSummary.parsing === 0
    const jobSettled =
        currentJob?.status === "completed" ||
        currentJob?.status === "completed_with_errors" ||
        currentJob?.status === "failed"

    const importFooter = jobId ? (
        <>
            <Button
                variant="ghost"
                className="text-muted-foreground sm:mr-auto"
                onClick={handleDeleteCurrentJob}
                disabled={!currentJob}
            >
                {jobSettled ? "Remove" : "Cancel import"}
            </Button>
            <Button
                variant={jobSettled ? "ghost" : "default"}
                className="min-w-24"
                onClick={() => setOpen(false)}
            >
                Close
            </Button>
            {jobSettled && (
                <Button className="min-w-24" onClick={startNewImport}>
                    New import
                </Button>
            )}
        </>
    ) : (
        <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isBusy}>
                Close
            </Button>
            {finished ? (
                <Button
                    className="min-w-24"
                    onClick={() => {
                        setOpen(false)
                        resetLocalImportState()
                    }}
                >
                    Done
                </Button>
            ) : isImporting ? (
                <Button disabled className="min-w-24">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Importing
                </Button>
            ) : queueSummary.retryable > 0 && queueSummary.retryable === queueSummary.toImport ? (
                <Button className="min-w-24" onClick={handleImport}>
                    Retry {queueSummary.retryable}
                </Button>
            ) : (
                <Button
                    className="min-w-24"
                    onClick={handleImport}
                    disabled={itemsReadyForImport.length === 0 || isParsingFiles}
                >
                    {itemsReadyForImport.length === 0
                        ? "Import"
                        : shouldUseAsyncImport
                          ? `Import ${itemsReadyForImport.length} in background`
                          : `Import ${itemsReadyForImport.length}`}
                </Button>
            )}
        </>
    )

    const jobProjectId = currentJob?.projectId ?? NO_FOLDER
    const importBody = (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 sm:px-0">
            <ImportSettingsRow
                projectId={jobId ? jobProjectId : selectedProjectId}
                onProjectIdChange={setSelectedProjectId}
                projects={projects}
                onCreateFolder={() => setShowNewFolderDialog(true)}
                mode={jobId && currentJob ? currentJob.attachmentMode : attachmentImportMode}
                onModeChange={setAttachmentImportMode}
                disabled={Boolean(jobId) || isBusy}
            />
            {jobId ? renderJobList() : renderQueueList()}
        </div>
    )

    const handleOpenChange = (nextOpen: boolean) => {
        if (!isBusy) {
            setOpen(nextOpen)
        }
    }

    const dragProps = {
        onDragEnter: handleDialogDragEnter,
        onDragLeave: handleDialogDragLeave,
        onDragOver: handleDialogDragOver,
        onDrop: handleDialogDrop
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
                className="hidden"
                onChange={handleFileInputChange}
            />

            {isMobile ? (
                <Drawer open={open} onOpenChange={handleOpenChange}>
                    <DrawerContent
                        className="z-[70] flex max-h-[90dvh] flex-col overflow-hidden"
                        overlayClassName="z-[70]"
                        {...dragProps}
                    >
                        <DrawerHeader className="shrink-0">
                            <DrawerTitle>Import Thread</DrawerTitle>
                            <DrawerDescription className="sr-only">
                                Import conversations from export files.
                            </DrawerDescription>
                        </DrawerHeader>
                        {importBody}
                        <DrawerFooter className="shrink-0 flex-row justify-end">
                            {importFooter}
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            ) : (
                <Dialog open={open} onOpenChange={handleOpenChange}>
                    <DialogContent
                        className="flex max-h-[88vh] flex-col overflow-hidden"
                        {...dragProps}
                    >
                        <DialogHeader className="shrink-0">
                            <DialogTitle>Import Thread</DialogTitle>
                            <DialogDescription className="sr-only">
                                Import conversations from export files.
                            </DialogDescription>
                        </DialogHeader>
                        {importBody}
                        <DialogFooter className="shrink-0">{importFooter}</DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <NewFolderDialog
                open={showNewFolderDialog}
                onOpenChange={setShowNewFolderDialog}
                className="z-[90]"
                onSuccess={(projectId) => {
                    setSelectedProjectId(projectId)
                }}
            />
        </>
    )
}
