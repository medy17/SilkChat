import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MODELS_SHARED, isChatModel } from "@/convex/lib/models"
import { browserEnv, optionalBrowserEnv } from "@/lib/browser-env"
import {
    type DraftAttachment,
    type DraftMessage,
    type DraftRole,
    type ExportDraft,
    buildDraftExport,
    createDraftAttachment,
    createDraftMessage,
    draftFromParsedDocument,
    findRepeatedRoleMessageIds,
    useExportBuilderStore
} from "@/lib/dev-export-builder"
import { BUILT_IN_PERSONAS, getBuiltInPersonaById } from "@/lib/personas/builtins"
import { downloadBlob } from "@/lib/thread-export"
import { parseThreadImportContent, parseThreadImportContents } from "@/lib/thread-import"
import { requestThreadImportFile } from "@/lib/thread-import-events"
import { cn } from "@/lib/utils"
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Copy,
    CopyPlus,
    Download,
    FileUp,
    FolderOpen,
    MoreHorizontal,
    Paperclip,
    Plus,
    RotateCcw,
    Trash2,
    X
} from "lucide-react"
import { nanoid } from "nanoid"
import { type ReactNode, useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

const NO_PERSONA = "none"

const ROLE_LABELS: Record<DraftRole, string> = {
    user: "User",
    assistant: "Assistant"
}

const CHAT_MODEL_NAMES = [
    ...new Set(
        MODELS_SHARED.filter((model) => isChatModel(model) && !model.legacy).map(
            (model) => model.name
        )
    )
]

// The exporter's own message for a draft with nothing written yet.
const EMPTY_DRAFT_ERROR = "Thread has no exportable content"

const inferFilename = (url: string) => {
    const tail = url.split(/[?#]/)[0]?.split("/").pop() ?? ""
    try {
        return decodeURIComponent(tail)
    } catch {
        return tail
    }
}

const formatDraftDate = (value: string | number) => {
    const date = new Date(value)
    return Number.isFinite(date.getTime())
        ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : "No date"
}

type BuildResult = ReturnType<typeof buildResult>

const buildResult = (draft: ExportDraft) => {
    try {
        const exported = buildDraftExport({
            draft,
            convexApiUrl: browserEnv("VITE_CONVEX_API_URL"),
            publicAssetBaseUrl: optionalBrowserEnv("VITE_R2_PUBLIC_BASE_URL")
        })
        const parsed = parseThreadImportContents({
            content: exported.markdown,
            fileName: exported.fileName
        })[0]
        return { exported, parsed, error: null }
    } catch (error) {
        return {
            exported: null,
            parsed: null,
            error: error instanceof Error ? error.message : "Could not build the export"
        }
    }
}

export function ExportBuilderDialog({
    open,
    onOpenChange
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const draft = useExportBuilderStore((state) => state.draft)
    const setDraft = useExportBuilderStore((state) => state.setDraft)
    const resetDraft = useExportBuilderStore((state) => state.resetDraft)
    const modelListId = useId()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const repeatedRoleIds = useMemo(
        () => findRepeatedRoleMessageIds(draft.messages),
        [draft.messages]
    )
    const result = useMemo(() => buildResult(draft), [draft])

    const setMessages = (update: (messages: DraftMessage[]) => DraftMessage[]) =>
        setDraft((current) => ({ ...current, messages: update(current.messages) }))

    const updateMessage = (id: string, patch: Partial<DraftMessage>) =>
        setMessages((messages) =>
            messages.map((message) => (message.id === id ? { ...message, ...patch } : message))
        )

    const moveMessage = (index: number, offset: -1 | 1) =>
        setMessages((current) => {
            const target = index + offset
            if (target < 0 || target >= current.length) return current
            const messages = [...current]
            ;[messages[index], messages[target]] = [messages[target], messages[index]]
            return messages
        })

    const duplicateMessage = (index: number) =>
        setMessages((current) => {
            const source = current[index]
            const messages = [...current]
            messages.splice(index + 1, 0, {
                ...source,
                id: nanoid(),
                attachments: source.attachments.map((attachment) => ({
                    ...attachment,
                    id: nanoid()
                }))
            })
            return messages
        })

    // A conversation alternates, so the next message takes the other role. Either can be
    // switched afterwards.
    const lastMessage = draft.messages.at(-1)
    const nextRole: DraftRole = lastMessage?.role === "user" ? "assistant" : "user"
    const addMessage = () => {
        const modelName =
            [...draft.messages].reverse().find((message) => message.modelName.trim())?.modelName ??
            ""
        setMessages((messages) => [...messages, createDraftMessage(nextRole, modelName)])
    }

    const handleCopy = async () => {
        if (!result.exported) return
        await navigator.clipboard.writeText(result.exported.markdown)
        toast.success("Markdown copied")
    }

    const handleDownload = () => {
        if (!result.exported) return
        downloadBlob({
            blob: new Blob([result.exported.markdown], { type: "text/markdown" }),
            fileName: result.exported.fileName
        })
    }

    const handleImport = () => {
        if (!result.exported) return
        const file = new File([result.exported.markdown], result.exported.fileName, {
            type: "text/markdown"
        })
        if (!requestThreadImportFile(file)) {
            toast.error("Open a chat page first. The Import dialog lives in the sidebar.")
            return
        }
        onOpenChange(false)
    }

    const handleOpenFile = async (file: File) => {
        try {
            const document = parseThreadImportContent({
                content: await file.text(),
                fileName: file.name,
                mimeType: file.type || undefined
            })
            const loaded = draftFromParsedDocument(document)
            setDraft(() => loaded)
            toast.success(`Loaded ${loaded.messages.length} messages from ${file.name}`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not read that file")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                data-dev-audit-ignore
                className="flex h-[min(56rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden rounded-[var(--radius-xl)] p-0 sm:max-w-6xl"
            >
                <DialogHeader className="border-b px-5 py-4">
                    <DialogTitle>Export builder</DialogTitle>
                    <DialogDescription>
                        Write a conversation and get the file a real export would produce.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:grid-rows-1">
                    <div className="min-h-0 overflow-y-auto">
                        <div className="mx-auto max-w-3xl space-y-5 p-5">
                            <ThreadDetails draft={draft} setDraft={setDraft} />

                            <datalist id={modelListId}>
                                {CHAT_MODEL_NAMES.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>

                            <div className="space-y-2">
                                {draft.messages.map((message, index) => (
                                    <MessageEditor
                                        key={message.id}
                                        message={message}
                                        modelListId={modelListId}
                                        repeatsRole={repeatedRoleIds.has(message.id)}
                                        isFirst={index === 0}
                                        isLast={index === draft.messages.length - 1}
                                        onChange={(patch) => updateMessage(message.id, patch)}
                                        onMove={(offset) => moveMessage(index, offset)}
                                        onDuplicate={() => duplicateMessage(index)}
                                        onDelete={() =>
                                            setMessages((messages) =>
                                                messages.filter((entry) => entry.id !== message.id)
                                            )
                                        }
                                    />
                                ))}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start rounded-[var(--radius-lg)] text-muted-foreground"
                                    onClick={addMessage}
                                >
                                    <Plus />
                                    {nextRole === "user" ? "Add a user message" : "Add a reply"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <FilePane
                        result={result}
                        draftMessageCount={draft.messages.length}
                        repeatedRoleCount={repeatedRoleIds.size}
                        onCopy={() => void handleCopy()}
                        onDownload={handleDownload}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-[var(--radius-md)]"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FolderOpen />
                        Open a file
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-[var(--radius-md)]"
                        onClick={resetDraft}
                    >
                        <RotateCcw />
                        Start over
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".md,.markdown,.txt,.json"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ""
                            if (file) void handleOpenFile(file)
                        }}
                    />
                    <Button
                        type="button"
                        size="sm"
                        className="ml-auto rounded-[var(--radius-md)]"
                        disabled={!result.exported}
                        onClick={handleImport}
                    >
                        <FileUp />
                        Import
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// The title is always in view. Everything else about the thread is rarely touched, so it
// collapses to one line that says what it is set to.
function ThreadDetails({
    draft,
    setDraft
}: {
    draft: ExportDraft
    setDraft: (update: (draft: ExportDraft) => ExportDraft) => void
}) {
    const [open, setOpen] = useState(false)
    const set = (patch: Partial<ExportDraft>) => setDraft((current) => ({ ...current, ...patch }))
    const persona = draft.personaId ? getBuiltInPersonaById(draft.personaId) : null

    return (
        <div className="space-y-1">
            <input
                aria-label="Title"
                placeholder="Untitled chat"
                value={draft.title}
                onChange={(event) => set({ title: event.target.value })}
                className="w-full bg-transparent font-semibold text-xl tracking-tight outline-none placeholder:text-muted-foreground"
            />
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="flex max-w-full items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
                <span className="truncate">
                    {persona?.name ?? "No Persona"} · {formatDraftDate(draft.createdAt)} ·{" "}
                    <span className="font-mono">{draft.threadId || "dev-export"}</span>
                </span>
                <ChevronDown
                    className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
                />
            </button>
            <AnimatedCollapsible open={open}>
                <div inert={!open} className="grid gap-3 pt-3 sm:grid-cols-2">
                    <Field label="Persona">
                        <Select
                            value={draft.personaId || NO_PERSONA}
                            onValueChange={(value) =>
                                set({ personaId: value === NO_PERSONA ? "" : value })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[80]">
                                <SelectItem value={NO_PERSONA}>None</SelectItem>
                                {BUILT_IN_PERSONAS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                        {entry.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Thread ID">
                        <Input
                            value={draft.threadId}
                            onChange={(event) => set({ threadId: event.target.value })}
                            className="font-mono"
                        />
                    </Field>
                    <Field label="Created">
                        <Input
                            type="datetime-local"
                            value={draft.createdAt}
                            onChange={(event) => set({ createdAt: event.target.value })}
                        />
                    </Field>
                    <Field label="Updated">
                        <Input
                            type="datetime-local"
                            value={draft.updatedAt}
                            onChange={(event) => set({ updatedAt: event.target.value })}
                        />
                    </Field>
                </div>
            </AnimatedCollapsible>
        </div>
    )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 text-muted-foreground text-xs">{label}</Label>
            {children}
        </div>
    )
}

// User messages are filled and assistant replies are outlined, so the draft reads as a
// conversation at a glance.
function MessageEditor({
    message,
    modelListId,
    repeatsRole,
    isFirst,
    isLast,
    onChange,
    onMove,
    onDuplicate,
    onDelete
}: {
    message: DraftMessage
    modelListId: string
    // Same role as the message before it. Allowed, but usually a slip.
    repeatsRole: boolean
    isFirst: boolean
    isLast: boolean
    onChange: (patch: Partial<DraftMessage>) => void
    onMove: (offset: -1 | 1) => void
    onDuplicate: () => void
    onDelete: () => void
}) {
    const isUser = message.role === "user"
    const updateAttachment = (id: string, update: (entry: DraftAttachment) => DraftAttachment) =>
        onChange({
            attachments: message.attachments.map((entry) =>
                entry.id === id ? update(entry) : entry
            )
        })

    return (
        <div
            className={cn(
                "space-y-2 rounded-[var(--radius-lg)] border p-3 transition-shadow focus-within:ring-1 focus-within:ring-ring/60",
                isUser ? "border-transparent bg-muted/60" : "bg-transparent"
            )}
        >
            <div className="flex items-center gap-2">
                <Tabs
                    value={message.role}
                    onValueChange={(role) => onChange({ role: role as DraftRole })}
                >
                    <TabsList
                        aria-label="Role"
                        className={cn("h-7", repeatsRole && "ring-1 ring-warning")}
                    >
                        {(Object.keys(ROLE_LABELS) as DraftRole[]).map((role) => (
                            <TabsTrigger key={role} value={role} className="px-2.5 text-xs">
                                {ROLE_LABELS[role]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                {!isUser && (
                    <input
                        list={modelListId}
                        aria-label="Model name"
                        placeholder="Model name"
                        value={message.modelName}
                        onChange={(event) => onChange({ modelName: event.target.value })}
                        className="min-w-0 flex-1 bg-transparent text-muted-foreground text-xs outline-none placeholder:text-muted-foreground/70 focus:text-foreground"
                    />
                )}
                <div className="ml-auto flex shrink-0 items-center">
                    <IconButton
                        label="Add an attachment link"
                        onClick={() =>
                            onChange({
                                attachments: [...message.attachments, createDraftAttachment()]
                            })
                        }
                    >
                        <Paperclip />
                    </IconButton>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Message actions"
                                className="size-7 shrink-0 rounded-[var(--radius-md)] text-muted-foreground [&_svg]:size-3.5"
                            >
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[80]">
                            <DropdownMenuItem disabled={isFirst} onClick={() => onMove(-1)}>
                                <ArrowUp className="size-4" />
                                Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={isLast} onClick={() => onMove(1)}>
                                <ArrowDown className="size-4" />
                                Move down
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDuplicate}>
                                <CopyPlus className="size-4" />
                                Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={onDelete}>
                                <Trash2 className="size-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Textarea
                aria-label={`${ROLE_LABELS[message.role]} message`}
                placeholder={isUser ? "What the user asked" : "What the model answered"}
                value={message.text}
                onChange={(event) => onChange({ text: event.target.value })}
                className="max-h-96 min-h-5 resize-none rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
            />

            {message.attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2">
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    <Input
                        aria-label="Attachment URL or R2 key"
                        placeholder="https://… or R2 key"
                        value={attachment.url}
                        onChange={(event) => {
                            const url = event.target.value
                            updateAttachment(attachment.id, (entry) => ({
                                ...entry,
                                url,
                                // Follow the URL until the filename is edited by hand.
                                filename:
                                    !entry.filename || entry.filename === inferFilename(entry.url)
                                        ? inferFilename(url)
                                        : entry.filename
                            }))
                        }}
                        className="h-8 min-w-0 flex-[2] text-xs md:text-xs"
                    />
                    <Input
                        aria-label="Attachment filename"
                        placeholder="filename.png"
                        value={attachment.filename}
                        onChange={(event) => {
                            const filename = event.target.value
                            updateAttachment(attachment.id, (entry) => ({ ...entry, filename }))
                        }}
                        className="h-8 min-w-0 flex-1 text-xs md:text-xs"
                    />
                    <IconButton
                        label="Remove attachment"
                        onClick={() =>
                            onChange({
                                attachments: message.attachments.filter(
                                    (entry) => entry.id !== attachment.id
                                )
                            })
                        }
                    >
                        <X />
                    </IconButton>
                </div>
            ))}
        </div>
    )
}

function IconButton({
    label,
    disabled,
    onClick,
    children
}: {
    label: string
    disabled?: boolean
    onClick: () => void
    children: ReactNode
}) {
    return (
        <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="size-7 shrink-0 rounded-[var(--radius-md)] text-muted-foreground [&_svg]:size-3.5"
        >
            {children}
        </Button>
    )
}

// The file the draft produces, and what the importer makes of it.
function FilePane({
    result,
    draftMessageCount,
    repeatedRoleCount,
    onCopy,
    onDownload
}: {
    result: BuildResult
    draftMessageCount: number
    repeatedRoleCount: number
    onCopy: () => void
    onDownload: () => void
}) {
    const [view, setView] = useState<"check" | "markdown">("check")
    const { exported, parsed, error } = result
    const empty = error === EMPTY_DRAFT_ERROR

    const dropped = parsed ? draftMessageCount - parsed.messages.length : 0
    const warnings = parsed
        ? [
              dropped > 0 && `${dropped} empty message${dropped === 1 ? "" : "s"} will be dropped.`,
              repeatedRoleCount > 0 &&
                  (repeatedRoleCount === 1
                      ? "1 message repeats the previous role. Its role switch is outlined."
                      : `${repeatedRoleCount} messages repeat the previous role. Their role switches are outlined.`),
              ...parsed.parseWarnings
          ].filter((warning): warning is string => Boolean(warning))
        : []

    return (
        <div className="flex min-h-0 flex-col border-t bg-muted/30 md:border-t-0 md:border-l">
            <div className="flex items-center gap-1 px-4 pt-3">
                <p className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
                    {exported?.fileName ?? "No file yet"}
                </p>
                <IconButton label="Copy markdown" disabled={!exported} onClick={onCopy}>
                    <Copy />
                </IconButton>
                <IconButton label="Download file" disabled={!exported} onClick={onDownload}>
                    <Download />
                </IconButton>
            </div>

            {!exported || !parsed ? (
                <p
                    className={cn(
                        "px-4 pt-2 text-xs",
                        empty ? "text-muted-foreground" : "text-destructive"
                    )}
                >
                    {empty ? "Write a message and the file appears here." : error}
                </p>
            ) : (
                <>
                    {warnings.length > 0 && (
                        <ul className="space-y-1.5 px-4 pt-2 text-xs">
                            {warnings.map((warning) => (
                                <li key={warning} className="flex items-start gap-1.5">
                                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                                    {warning}
                                </li>
                            ))}
                        </ul>
                    )}
                    <Tabs
                        value={view}
                        onValueChange={(value) => setView(value as typeof view)}
                        className="px-4 pt-3"
                    >
                        <TabsList className="grid h-8 w-full grid-cols-2">
                            <TabsTrigger value="check" className="text-xs">
                                Reads back as
                            </TabsTrigger>
                            <TabsTrigger value="markdown" className="text-xs">
                                Markdown
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {view === "check" ? (
                            <ReadBack parsed={parsed} />
                        ) : (
                            <pre className="whitespace-pre-wrap break-words font-mono text-muted-foreground text-xs leading-relaxed">
                                {exported.markdown}
                            </pre>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

// What the importer reads from the generated file, which is what a thread would be made from.
function ReadBack({ parsed }: { parsed: NonNullable<BuildResult["parsed"]> }) {
    return (
        <div className="space-y-4 text-xs">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Title</dt>
                <dd className="truncate">{parsed.title}</dd>
                <dt className="text-muted-foreground">Persona</dt>
                <dd>{parsed.personaSnapshot?.name ?? "None"}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>
                    {parsed.source.createdAt ? formatDraftDate(parsed.source.createdAt) : "None"}
                </dd>
            </dl>
            <ol className="space-y-3">
                {parsed.messages.map((message, index) => (
                    <li key={index}>
                        <p className="font-medium">
                            {message.role === "assistant" ? "Assistant" : "User"}
                            <span className="font-normal text-muted-foreground">
                                {message.metadata?.modelName && ` · ${message.metadata.modelName}`}
                                {message.attachments.length > 0 &&
                                    ` · ${message.attachments.length} attachment${
                                        message.attachments.length === 1 ? "" : "s"
                                    }`}
                            </span>
                        </p>
                        <p className="mt-0.5 line-clamp-3 text-muted-foreground">
                            {message.text || "(no text)"}
                        </p>
                    </li>
                ))}
            </ol>
        </div>
    )
}
