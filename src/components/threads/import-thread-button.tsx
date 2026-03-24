import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useToken } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import type { ParsedThreadImportDocument } from "@/lib/thread-import"
import {
    fetchRemoteAttachmentAsFile,
    parseThreadImportMarkdown,
    prepareImportedAttachmentFile
} from "@/lib/thread-import"
import { dispatchThreadImportDialogState } from "@/lib/thread-import-events"
import { cn } from "@/lib/utils"
import { useMutation } from "convex/react"
import { CheckCircle2, FileText, FileUp, Loader2, Plus, Trash2, XCircle } from "lucide-react"
import { nanoid } from "nanoid"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { NewFolderDialog } from "./new-folder-button"
import type { Project } from "./types"

type ImportMutationMessage = {
    role: "user" | "assistant" | "system"
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

type ImportQueueStatus = "parsing" | "ready" | "importing" | "success" | "error" | "invalid"

interface ImportQueueItem {
    id: string
    fileName: string
    selected: boolean
    status: ImportQueueStatus
    parsed?: ParsedThreadImportDocument
    messageCount: number
    attachmentCount: number
    parseWarning?: string
    error?: string
    threadId?: Id<"threads">
    importedAttachmentCount?: number
    failedAttachmentCount?: number
}

const statusLabel: Record<ImportQueueStatus, string> = {
    parsing: "Parsing",
    ready: "Ready",
    importing: "Importing",
    success: "Imported",
    error: "Failed",
    invalid: "Invalid"
}

const statusClasses: Record<ImportQueueStatus, string> = {
    parsing: "bg-muted text-muted-foreground",
    ready: "bg-primary/10 text-primary",
    importing: "bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20",
    error: "bg-destructive/10 text-destructive dark:text-red-400 dark:bg-destructive/20",
    invalid: "bg-destructive/10 text-destructive dark:text-red-400 dark:bg-destructive/20"
}

const importConcurrencyOptions = [1, 2, 3] as const
const markdownExtensionRegex = /\.(md|markdown|txt)$/i
const attachmentThrottleThresholds = {
    high: 120,
    medium: 40
} as const

const uploadAttachment = async ({
    file,
    jwt
}: {
    file: File
    jwt: string
}) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("fileName", file.name)

    const response = await fetch(`${browserEnv("VITE_CONVEX_API_URL")}/upload`, {
        method: "POST",
        body: formData,
        headers: {
            Authorization: `Bearer ${jwt}`
        }
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || `Upload failed with status ${response.status}`)
    }

    return (await response.json()) as {
        key: string
        fileName: string
        fileType: string
    }
}

export function ImportThreadButton({ onClick }: { onClick: () => void }) {
    return (
        <Button variant="outline" onClick={onClick} className="w-full justify-center">
            <FileUp className="h-4 w-4" />
            Import Thread
        </Button>
    )
}

export function ImportThreadDialog({
    open,
    onOpenChange,
    projects,
    onImported
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    projects: Project[]
    onImported?: (threadId: Id<"threads">) => void
}) {
    const { token } = useToken()
    const isMobile = useIsMobile()
    const importThreadMutation = useMutation(api.threads.importThread)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dragDepthRef = useRef(0)

    const setOpen = onOpenChange
    const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
    const [selectOpen, setSelectOpen] = useState(false)
    const [queue, setQueue] = useState<ImportQueueItem[]>([])
    const [isParsingFiles, setIsParsingFiles] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isDropZoneActive, setIsDropZoneActive] = useState(false)
    const [importAttachments, setImportAttachments] = useState(true)
    const [selectedProjectId, setSelectedProjectId] = useState<string>("no-folder")

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

    // Keep internal alias for setOpen used throughout the component
    // (onOpenChange is the controlled prop from parent)

    const selectableQueueItems = useMemo(
        () => queue.filter((item) => item.status !== "parsing" && item.status !== "importing"),
        [queue]
    )

    const selectedSelectableCount = useMemo(
        () => selectableQueueItems.filter((item) => item.selected).length,
        [selectableQueueItems]
    )

    const hasSelectableItems = selectableQueueItems.length > 0
    const allSelectableChecked =
        hasSelectableItems && selectedSelectableCount === selectableQueueItems.length
    const someSelectableChecked =
        selectedSelectableCount > 0 && selectedSelectableCount < selectableQueueItems.length

    const itemsReadyForImport = useMemo(
        () =>
            queue.filter(
                (item) =>
                    item.selected &&
                    (item.status === "ready" || item.status === "error") &&
                    item.parsed
            ),
        [queue]
    )

    const selectedAttachmentCount = useMemo(
        () => itemsReadyForImport.reduce((sum, item) => sum + item.attachmentCount, 0),
        [itemsReadyForImport]
    )

    const selectedMessageCount = useMemo(
        () => itemsReadyForImport.reduce((sum, item) => sum + item.messageCount, 0),
        [itemsReadyForImport]
    )

    const requestedConcurrency = useMemo(() => {
        return 2 // Hardcoded default reasonable concurrency
    }, [])

    const effectiveConcurrency = useMemo(() => {
        if (!importAttachments) {
            return requestedConcurrency
        }

        if (selectedAttachmentCount >= attachmentThrottleThresholds.high) {
            return 1
        }

        if (selectedAttachmentCount >= attachmentThrottleThresholds.medium) {
            return Math.min(requestedConcurrency, 2)
        }

        return requestedConcurrency
    }, [importAttachments, requestedConcurrency, selectedAttachmentCount])

    const isConcurrencyThrottled = effectiveConcurrency < requestedConcurrency

    const canImport = itemsReadyForImport.length > 0 && !isImporting && !isParsingFiles

    const summary = useMemo(() => {
        const success = queue.filter((item) => item.status === "success").length
        const failed = queue.filter(
            (item) => item.status === "error" || item.status === "invalid"
        ).length
        const pending = queue.filter((item) => item.status === "ready").length

        return { success, failed, pending }
    }, [queue])

    const updateQueueItem = (id: string, updater: (item: ImportQueueItem) => ImportQueueItem) => {
        setQueue((previous) => previous.map((item) => (item.id === id ? updater(item) : item)))
    }

    const sanitizeIncomingFiles = (files: File[]) => {
        const accepted: File[] = []
        let rejected = 0

        for (const file of files) {
            const matchesByType =
                file.type === "text/markdown" ||
                file.type === "text/plain" ||
                file.type === "application/markdown"

            const matchesByName = markdownExtensionRegex.test(file.name)

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
                `Skipped ${rejected} file${rejected > 1 ? "s" : ""}. Use markdown files only.`
            )
        }

        if (accepted.length === 0) {
            return
        }

        const queuedItems: ImportQueueItem[] = accepted.map((file) => ({
            id: nanoid(),
            fileName: file.name,
            selected: true,
            status: "parsing",
            messageCount: 0,
            attachmentCount: 0
        }))

        setQueue((previous) => [...previous, ...queuedItems])
        setIsParsingFiles(true)

        await Promise.all(
            queuedItems.map(async (queuedItem, index) => {
                const file = accepted[index]

                try {
                    const markdown = await file.text()
                    const parsed = parseThreadImportMarkdown(markdown)

                    if (parsed.messages.length === 0) {
                        updateQueueItem(queuedItem.id, (item) => ({
                            ...item,
                            selected: false,
                            status: "invalid",
                            parsed,
                            error: parsed.parseWarnings[0] || "No importable messages found"
                        }))
                        return
                    }

                    const attachmentCount = parsed.messages.reduce(
                        (sum, message) => sum + message.attachments.length,
                        0
                    )

                    updateQueueItem(queuedItem.id, (item) => ({
                        ...item,
                        status: "ready",
                        parsed,
                        messageCount: parsed.messages.length,
                        attachmentCount,
                        parseWarning: parsed.parseWarnings[0],
                        error: undefined
                    }))
                } catch (error) {
                    updateQueueItem(queuedItem.id, (item) => ({
                        ...item,
                        selected: false,
                        status: "invalid",
                        error:
                            error instanceof Error ? error.message : "Unable to parse markdown file"
                    }))
                }
            })
        )

        setIsParsingFiles(false)
    }

    const handleDialogDragEnter = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()

        if (!open || isImporting || isParsingFiles) {
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

        if (isImporting || isParsingFiles) {
            return
        }

        const files = Array.from(event.dataTransfer.files || [])
        await handleAddFiles(files)
    }

    const importSingleQueueItem = async ({
        item,
        jwt
    }: {
        item: ImportQueueItem
        jwt: string
    }) => {
        if (!item.parsed) {
            throw new Error("Missing parsed conversation data")
        }

        let importedAttachmentCount = 0
        let failedAttachmentCount = 0
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

            if (importAttachments) {
                for (const attachment of parsedMessage.attachments) {
                    try {
                        const downloadedFile = await fetchRemoteAttachmentAsFile({
                            url: attachment.url,
                            filename: attachment.filename
                        })

                        const preparedFile = await prepareImportedAttachmentFile(downloadedFile)
                        const uploaded = await uploadAttachment({
                            file: preparedFile,
                            jwt
                        })

                        parts.push({
                            type: "file",
                            data: uploaded.key,
                            filename: uploaded.fileName,
                            mimeType: uploaded.fileType
                        })

                        importedAttachmentCount += 1
                    } catch (error) {
                        failedAttachmentCount += 1
                        console.warn(
                            `[thread-import] Failed attachment import for ${attachment.url}`,
                            error
                        )
                    }
                }
            }

            if (parts.length > 0) {
                preparedMessages.push({
                    role: parsedMessage.role,
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
            projectId
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
        if (itemsReadyForImport.length === 0) {
            toast.error("Select at least one valid conversation to import")
            return
        }

        setIsImporting(true)
        try {
            const jwt = await resolveJwtToken(token)
            if (!jwt) {
                throw new Error("Authentication token unavailable")
            }

            let successCount = 0
            let failedCount = 0

            const importQueue = [...itemsReadyForImport]
            let cursor = 0
            const workerCount = Math.min(effectiveConcurrency, importQueue.length)

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
                            jwt
                        })

                        successCount += 1
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
                        failedCount += 1
                        updateQueueItem(queueItem.id, (item) => ({
                            ...item,
                            status: "error",
                            error: error instanceof Error ? error.message : "Import failed"
                        }))
                    }
                }
            }

            await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

            if (successCount > 0) {
                toast.success(`Imported ${successCount} conversation${successCount > 1 ? "s" : ""}`)
            }
            if (failedCount > 0) {
                toast.error(`${failedCount} conversation${failedCount > 1 ? "s" : ""} failed`)
            }
        } catch (error) {
            console.error("[thread-import] failed", error)
            toast.error(error instanceof Error ? error.message : "Failed to import thread")
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.markdown,text/markdown,text/plain"
                className="hidden"
                onChange={handleFileInputChange}
            />

            {(() => {
                const handleOpenChange = (nextOpen: boolean) => {
                    if (!isImporting && !isParsingFiles) {
                        setOpen(nextOpen)
                    }
                }

                const dragProps = {
                    onDragEnter: handleDialogDragEnter,
                    onDragLeave: handleDialogDragLeave,
                    onDragOver: handleDialogDragOver,
                    onDrop: handleDialogDrop
                }

                const importBody = (
                    <div className="space-y-6 overflow-y-auto px-4 sm:px-0">
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <div className="flex-[2] space-y-2">
                                <Label htmlFor="thread-import-folder">Destination Folder</Label>
                                <div className="flex items-center gap-2">
                                    <Select
                                        open={selectOpen}
                                        onOpenChange={setSelectOpen}
                                        value={selectedProjectId}
                                        onValueChange={setSelectedProjectId}
                                        disabled={isImporting || isParsingFiles}
                                    >
                                        <SelectTrigger id="thread-import-folder" className="flex-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="z-[80]">
                                            <SelectItem value="no-folder">
                                                General (No Folder)
                                            </SelectItem>
                                            {projects.map((project) => (
                                                <SelectItem key={project._id} value={project._id}>
                                                    {project.name}
                                                </SelectItem>
                                            ))}
                                            <SelectSeparator />
                                            <button
                                                type="button"
                                                className="flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-primary text-sm outline-hidden hover:bg-accent focus:bg-accent"
                                                onPointerDown={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                }}
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setSelectOpen(false)
                                                    setShowNewFolderDialog(true)
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                                <span>Create Folder</span>
                                            </button>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex-1 shrink-0 space-y-2">
                                <Label className="invisible hidden sm:block">Options</Label>
                                <div className="flex h-9 items-center rounded-md border bg-muted/10 px-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="thread-import-attachments"
                                            checked={importAttachments}
                                            onCheckedChange={(checked) =>
                                                setImportAttachments(
                                                    checked === "indeterminate"
                                                        ? true
                                                        : Boolean(checked)
                                                )
                                            }
                                            disabled={isImporting || isParsingFiles}
                                        />
                                        <Label
                                            htmlFor="thread-import-attachments"
                                            className="font-normal text-sm"
                                        >
                                            Fetch remote attachments
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting || isParsingFiles}
                            className="w-full sm:hidden"
                        >
                            <FileUp className="h-4 w-4" />
                            Select Files
                        </Button>

                        <div
                            className={cn(
                                "flex flex-col rounded-md border transition-colors",
                                isDropZoneActive && "border-primary bg-primary/5"
                            )}
                        >
                            <div className="flex items-center justify-between border-b bg-muted/10 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={
                                            allSelectableChecked
                                                ? true
                                                : someSelectableChecked
                                                  ? "indeterminate"
                                                  : false
                                        }
                                        onCheckedChange={(checked) => {
                                            const isChecked =
                                                checked === "indeterminate"
                                                    ? true
                                                    : Boolean(checked)

                                            setQueue((previous) =>
                                                previous.map((item) =>
                                                    item.status === "parsing" ||
                                                    item.status === "importing"
                                                        ? item
                                                        : {
                                                              ...item,
                                                              selected: isChecked
                                                          }
                                                )
                                            )
                                        }}
                                        disabled={
                                            !hasSelectableItems || isImporting || isParsingFiles
                                        }
                                    />
                                    <span className="font-medium text-sm">Conversation queue</span>
                                </div>

                                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                    <span>Ready: {summary.pending}</span>
                                    <span>Imported: {summary.success}</span>
                                    <span>Issues: {summary.failed}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/20 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isImporting || isParsingFiles}
                                    className="hidden h-8 shrink-0 px-2 sm:inline-flex sm:px-3"
                                >
                                    <FileUp className="h-3.5 w-3.5 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Add Files</span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                        setQueue((previous) =>
                                            previous.filter((item) => !item.selected)
                                        )
                                    }
                                    disabled={
                                        selectedSelectableCount === 0 ||
                                        isImporting ||
                                        isParsingFiles
                                    }
                                    className="h-8 shrink-0 px-2 text-muted-foreground sm:px-3"
                                >
                                    <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Remove Selected</span>
                                    <span className="text-xs sm:hidden">Remove</span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                        setQueue((previous) =>
                                            previous.filter((item) => item.status !== "success")
                                        )
                                    }
                                    disabled={
                                        summary.success === 0 || isImporting || isParsingFiles
                                    }
                                    className="h-8 shrink-0 px-2 text-muted-foreground sm:px-3"
                                >
                                    <span className="hidden sm:inline">Clear Completed</span>
                                    <span className="text-xs sm:hidden">Clear</span>
                                </Button>
                                {(isParsingFiles || isImporting) && (
                                    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span className="hidden sm:inline">
                                            {isParsingFiles ? "Parsing..." : "Importing..."}
                                        </span>
                                    </span>
                                )}
                            </div>

                            {isDropZoneActive && (
                                <div className="hidden border-b bg-primary/10 px-3 py-4 text-center font-medium text-primary text-sm sm:block">
                                    Drop markdown files here to add them to the queue
                                </div>
                            )}

                            <div className="max-h-[30vh] min-h-[120px] overflow-y-auto sm:max-h-[40vh] sm:min-h-[150px]">
                                {queue.length === 0 ? (
                                    <div className="p-10 text-center text-muted-foreground">
                                        <FileText className="mx-auto mb-3 h-10 w-10 opacity-20" />
                                        <p className="font-medium text-sm">No files selected yet</p>
                                        <p className="mt-1 hidden text-xs opacity-70 sm:block">
                                            Drag and drop markdown files here
                                        </p>
                                        <p className="mt-1 text-xs opacity-70 sm:hidden">
                                            Tap "Select Files" above to add markdown exports
                                        </p>
                                    </div>
                                ) : (
                                    queue.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-start gap-3 border-b px-3 py-3 last:border-b-0"
                                        >
                                            <Checkbox
                                                checked={item.selected}
                                                onCheckedChange={(checked) =>
                                                    setQueue((previous) =>
                                                        previous.map((currentItem) =>
                                                            currentItem.id !== item.id ||
                                                            currentItem.status === "parsing" ||
                                                            currentItem.status === "importing"
                                                                ? currentItem
                                                                : {
                                                                      ...currentItem,
                                                                      selected:
                                                                          checked ===
                                                                          "indeterminate"
                                                                              ? true
                                                                              : Boolean(checked)
                                                                  }
                                                        )
                                                    )
                                                }
                                                disabled={
                                                    item.status === "parsing" ||
                                                    item.status === "importing" ||
                                                    isImporting ||
                                                    isParsingFiles
                                                }
                                            />

                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <p className="truncate font-medium text-sm">
                                                        {item.fileName}
                                                    </p>
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "text-xs",
                                                            statusClasses[item.status]
                                                        )}
                                                    >
                                                        {statusLabel[item.status]}
                                                    </Badge>
                                                </div>

                                                <p className="text-muted-foreground text-xs">
                                                    {item.messageCount} messages,{" "}
                                                    {item.attachmentCount} attachments
                                                </p>

                                                {item.parseWarning && (
                                                    <p className="text-amber-600 text-xs dark:text-amber-400">
                                                        {item.parseWarning}
                                                    </p>
                                                )}

                                                {item.error && (
                                                    <p className="inline-flex items-center gap-1 text-destructive text-xs">
                                                        <XCircle className="h-3 w-3" />
                                                        {item.error}
                                                    </p>
                                                )}

                                                {item.status === "success" && (
                                                    <div className="inline-flex flex-wrap items-center gap-2 text-emerald-600 text-xs dark:text-emerald-400">
                                                        <span className="inline-flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Imported
                                                        </span>
                                                        <span>
                                                            Attachments:{" "}
                                                            {item.importedAttachmentCount ?? 0}
                                                        </span>
                                                        {(item.failedAttachmentCount ?? 0) > 0 && (
                                                            <span>
                                                                Skipped:{" "}
                                                                {item.failedAttachmentCount}
                                                            </span>
                                                        )}
                                                        {item.threadId && onImported && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    onImported(item.threadId!)
                                                                }
                                                                className="h-6 px-2 text-xs"
                                                            >
                                                                Open
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setQueue((previous) =>
                                                        previous.filter(
                                                            (current) => current.id !== item.id
                                                        )
                                                    )
                                                }
                                                className="h-7 w-7"
                                                disabled={
                                                    item.status === "importing" ||
                                                    item.status === "parsing" ||
                                                    isImporting ||
                                                    isParsingFiles
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )

                const importFooter = (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isImporting || isParsingFiles}
                        >
                            Close
                        </Button>
                        <Button onClick={handleImport} disabled={!canImport}>
                            {isImporting
                                ? "Importing..."
                                : `Import selected (${itemsReadyForImport.length})`}
                        </Button>
                    </>
                )

                if (isMobile) {
                    return (
                        <Drawer open={open} onOpenChange={handleOpenChange}>
                            <DrawerContent
                                className="z-[70] max-h-[90dvh]"
                                overlayClassName="z-[70]"
                                {...dragProps}
                            >
                                <DrawerHeader>
                                    <DrawerTitle>Import Thread</DrawerTitle>
                                    <DrawerDescription>
                                        Select markdown exports, review, then import.
                                    </DrawerDescription>
                                </DrawerHeader>
                                {importBody}
                                <DrawerFooter className="flex-row justify-end">
                                    {importFooter}
                                </DrawerFooter>
                            </DrawerContent>
                        </Drawer>
                    )
                }

                return (
                    <Dialog open={open} onOpenChange={handleOpenChange}>
                        <DialogContent
                            className="max-h-[88vh] max-w-3xl overflow-hidden"
                            {...dragProps}
                        >
                            <DialogHeader>
                                <DialogTitle>Import Thread</DialogTitle>
                                <DialogDescription>
                                    Select one or more markdown exports, review validation status,
                                    then import selected conversations.
                                </DialogDescription>
                            </DialogHeader>
                            {importBody}
                            <DialogFooter>{importFooter}</DialogFooter>
                        </DialogContent>
                    </Dialog>
                )
            })()}

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
