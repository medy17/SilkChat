import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MODELS_SHARED, isChatModel } from "@/convex/lib/models"
import { browserEnv, optionalBrowserEnv } from "@/lib/browser-env"
import {
    type DraftMessage,
    type DraftRole,
    buildDraftExport,
    createDraftAttachment,
    createDraftMessage,
    findRepeatedRoleMessageIds,
    draftFromParsedDocument,
    useExportBuilderStore
} from "@/lib/dev-export-builder"
import { BUILT_IN_PERSONAS } from "@/lib/personas/builtins"
import { downloadBlob } from "@/lib/thread-export"
import { parseThreadImportContent, parseThreadImportContents } from "@/lib/thread-import"
import { requestThreadImportFile } from "@/lib/thread-import-events"
import {
    ArrowDown,
    ArrowUp,
    Copy,
    CopyPlus,
    Download,
    FileUp,
    FolderOpen,
    Link2,
    Plus,
    RotateCcw,
    Trash2,
    X
} from "lucide-react"
import { nanoid } from "nanoid"
import { type ReactNode, useId, useMemo, useRef } from "react"
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

const inferFilename = (url: string) => {
    const tail = url.split(/[?#]/)[0]?.split("/").pop() ?? ""
    try {
        return decodeURIComponent(tail)
    } catch {
        return tail
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

    const result = useMemo(() => {
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
    }, [draft])

    const updateMessage = (id: string, update: (message: DraftMessage) => DraftMessage) =>
        setDraft((current) => ({
            ...current,
            messages: current.messages.map((message) =>
                message.id === id ? update(message) : message
            )
        }))

    const moveMessage = (index: number, offset: -1 | 1) =>
        setDraft((current) => {
            const target = index + offset
            if (target < 0 || target >= current.messages.length) return current
            const messages = [...current.messages]
            ;[messages[index], messages[target]] = [messages[target], messages[index]]
            return { ...current, messages }
        })

    const lastModelName = () =>
        [...draft.messages].reverse().find((message) => message.modelName.trim())?.modelName ?? ""

    const appendMessages = (roles: DraftRole[]) => {
        const modelName = lastModelName()
        setDraft((current) => ({
            ...current,
            messages: [
                ...current.messages,
                ...roles.map((role) => createDraftMessage(role, modelName))
            ]
        }))
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
                        Fake a conversation and run it through the real markdown exporter.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:grid-rows-1">
                    <div className="min-h-0 space-y-5 overflow-y-auto p-5">
                        <section className="grid gap-3 sm:grid-cols-2">
                            <Field label="Title" className="sm:col-span-2">
                                <Input
                                    value={draft.title}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            title: event.target.value
                                        }))
                                    }
                                />
                            </Field>
                            <Field label="Created">
                                <Input
                                    type="datetime-local"
                                    value={draft.createdAt}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            createdAt: event.target.value
                                        }))
                                    }
                                />
                            </Field>
                            <Field label="Updated">
                                <Input
                                    type="datetime-local"
                                    value={draft.updatedAt}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            updatedAt: event.target.value
                                        }))
                                    }
                                />
                            </Field>
                            <Field label="Persona">
                                <Select
                                    value={draft.personaId || NO_PERSONA}
                                    onValueChange={(value) =>
                                        setDraft((current) => ({
                                            ...current,
                                            personaId: value === NO_PERSONA ? "" : value
                                        }))
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[80]">
                                        <SelectItem value={NO_PERSONA}>None</SelectItem>
                                        {BUILT_IN_PERSONAS.map((persona) => (
                                            <SelectItem key={persona.id} value={persona.id}>
                                                {persona.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Thread ID">
                                <Input
                                    value={draft.threadId}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            threadId: event.target.value
                                        }))
                                    }
                                />
                            </Field>
                        </section>

                        <datalist id={modelListId}>
                            {CHAT_MODEL_NAMES.map((name) => (
                                <option key={name} value={name} />
                            ))}
                        </datalist>

                        <section className="space-y-3">
                            {draft.messages.map((message, index) => (
                                <div
                                    key={message.id}
                                    className="space-y-2 rounded-[var(--radius-lg)] border p-3"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Select
                                            value={message.role}
                                            onValueChange={(role) =>
                                                updateMessage(message.id, (current) => ({
                                                    ...current,
                                                    role: role as DraftRole
                                                }))
                                            }
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                className="w-32"
                                                aria-invalid={repeatedRoleIds.has(message.id)}
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="z-[80]">
                                                {(Object.keys(ROLE_LABELS) as DraftRole[]).map(
                                                    (role) => (
                                                        <SelectItem key={role} value={role}>
                                                            {ROLE_LABELS[role]}
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {message.role === "assistant" && (
                                            <Input
                                                list={modelListId}
                                                placeholder="Model name"
                                                value={message.modelName}
                                                onChange={(event) =>
                                                    updateMessage(message.id, (current) => ({
                                                        ...current,
                                                        modelName: event.target.value
                                                    }))
                                                }
                                                className="h-8 min-w-0 flex-1"
                                            />
                                        )}
                                        <div className="ml-auto flex items-center">
                                            <IconButton
                                                label="Move up"
                                                disabled={index === 0}
                                                onClick={() => moveMessage(index, -1)}
                                            >
                                                <ArrowUp />
                                            </IconButton>
                                            <IconButton
                                                label="Move down"
                                                disabled={index === draft.messages.length - 1}
                                                onClick={() => moveMessage(index, 1)}
                                            >
                                                <ArrowDown />
                                            </IconButton>
                                            <IconButton
                                                label="Add attachment"
                                                onClick={() =>
                                                    updateMessage(message.id, (current) => ({
                                                        ...current,
                                                        attachments: [
                                                            ...current.attachments,
                                                            createDraftAttachment()
                                                        ]
                                                    }))
                                                }
                                            >
                                                <Link2 />
                                            </IconButton>
                                            <IconButton
                                                label="Duplicate"
                                                onClick={() =>
                                                    setDraft((current) => {
                                                        const messages = [...current.messages]
                                                        messages.splice(index + 1, 0, {
                                                            ...message,
                                                            id: nanoid(),
                                                            attachments: message.attachments.map(
                                                                (attachment) => ({
                                                                    ...attachment,
                                                                    id: nanoid()
                                                                })
                                                            )
                                                        })
                                                        return { ...current, messages }
                                                    })
                                                }
                                            >
                                                <CopyPlus />
                                            </IconButton>
                                            <IconButton
                                                label="Delete"
                                                onClick={() =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        messages: current.messages.filter(
                                                            (entry) => entry.id !== message.id
                                                        )
                                                    }))
                                                }
                                            >
                                                <Trash2 />
                                            </IconButton>
                                        </div>
                                    </div>
                                    <Textarea
                                        placeholder={`${ROLE_LABELS[message.role]} message (markdown)`}
                                        value={message.text}
                                        onChange={(event) =>
                                            updateMessage(message.id, (current) => ({
                                                ...current,
                                                text: event.target.value
                                            }))
                                        }
                                        className="max-h-96 font-mono text-xs md:text-xs"
                                    />
                                    {message.attachments.map((attachment) => (
                                        <div key={attachment.id} className="flex gap-2">
                                            <Input
                                                placeholder="https://… or R2 key"
                                                value={attachment.url}
                                                onChange={(event) => {
                                                    const url = event.target.value
                                                    updateMessage(message.id, (current) => ({
                                                        ...current,
                                                        attachments: current.attachments.map(
                                                            (entry) =>
                                                                entry.id === attachment.id
                                                                    ? {
                                                                          ...entry,
                                                                          url,
                                                                          // Follow the URL until the filename is edited by hand.
                                                                          filename:
                                                                              !entry.filename ||
                                                                              entry.filename ===
                                                                                  inferFilename(
                                                                                      entry.url
                                                                                  )
                                                                                  ? inferFilename(
                                                                                        url
                                                                                    )
                                                                                  : entry.filename
                                                                      }
                                                                    : entry
                                                        )
                                                    }))
                                                }}
                                                className="h-8 min-w-0 flex-[2] text-xs"
                                            />
                                            <Input
                                                placeholder="filename.png"
                                                value={attachment.filename}
                                                onChange={(event) => {
                                                    const filename = event.target.value
                                                    updateMessage(message.id, (current) => ({
                                                        ...current,
                                                        attachments: current.attachments.map(
                                                            (entry) =>
                                                                entry.id === attachment.id
                                                                    ? { ...entry, filename }
                                                                    : entry
                                                        )
                                                    }))
                                                }}
                                                className="h-8 min-w-0 flex-1 text-xs"
                                            />
                                            <IconButton
                                                label="Remove attachment"
                                                onClick={() =>
                                                    updateMessage(message.id, (current) => ({
                                                        ...current,
                                                        attachments: current.attachments.filter(
                                                            (entry) => entry.id !== attachment.id
                                                        )
                                                    }))
                                                }
                                            >
                                                <X />
                                            </IconButton>
                                        </div>
                                    ))}
                                </div>
                            ))}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-[var(--radius-md)]"
                                    onClick={() => appendMessages(["user", "assistant"])}
                                >
                                    <Plus />
                                    Turn
                                </Button>
                                {(Object.keys(ROLE_LABELS) as DraftRole[]).map((role) => (
                                    <Button
                                        key={role}
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="rounded-[var(--radius-md)]"
                                        onClick={() => appendMessages([role])}
                                    >
                                        <Plus />
                                        {ROLE_LABELS[role]}
                                    </Button>
                                ))}
                            </div>
                        </section>
                    </div>

                    <Tabs
                        defaultValue="check"
                        className="flex min-h-0 flex-col gap-0 border-t bg-muted/30 md:border-t-0 md:border-l"
                    >
                        <TabsList className="m-3 mb-0 grid grid-cols-2">
                            <TabsTrigger value="check" className="text-xs">
                                Import check
                            </TabsTrigger>
                            <TabsTrigger value="markdown" className="text-xs">
                                Markdown
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="check" className="min-h-0 flex-1 overflow-y-auto p-3">
                            <ImportCheck
                                error={result.error}
                                parsed={result.parsed}
                                draftMessageCount={draft.messages.length}
                                repeatedRoleCount={repeatedRoleIds.size}
                            />
                        </TabsContent>
                        <TabsContent
                            value="markdown"
                            className="min-h-0 flex-1 overflow-y-auto p-3"
                        >
                            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground leading-relaxed">
                                {result.exported?.markdown ?? result.error}
                            </pre>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-[var(--radius-md)]"
                        onClick={resetDraft}
                    >
                        <RotateCcw />
                        Reset
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-[var(--radius-md)]"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FolderOpen />
                        Open
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
                    <div className="ml-auto flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-[var(--radius-md)]"
                            disabled={!result.exported}
                            onClick={() => void handleCopy()}
                        >
                            <Copy />
                            Copy
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-[var(--radius-md)]"
                            disabled={!result.exported}
                            onClick={handleDownload}
                        >
                            <Download />
                            Download
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="rounded-[var(--radius-md)]"
                            disabled={!result.exported}
                            onClick={handleImport}
                        >
                            <FileUp />
                            Import
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Field({
    label,
    className,
    children
}: {
    label: string
    className?: string
    children: ReactNode
}) {
    return (
        <div className={className}>
            <Label className="mb-1.5 text-muted-foreground text-xs">{label}</Label>
            {children}
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
            className="size-8 shrink-0 rounded-[var(--radius-md)] [&_svg]:size-3.5"
        >
            {children}
        </Button>
    )
}

// What the importer will read back from the generated file.
function ImportCheck({
    error,
    parsed,
    draftMessageCount,
    repeatedRoleCount
}: {
    error: string | null
    parsed: ReturnType<typeof parseThreadImportContents>[number] | null
    draftMessageCount: number
    repeatedRoleCount: number
}) {
    if (error || !parsed) {
        return <p className="text-destructive text-xs">{error ?? "Nothing to import"}</p>
    }

    const dropped = draftMessageCount - parsed.messages.length

    return (
        <div className="space-y-3 text-xs">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Title</dt>
                <dd className="truncate">{parsed.title}</dd>
                <dt className="text-muted-foreground">Persona</dt>
                <dd>{parsed.personaSnapshot?.name ?? "None"}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>
                    {parsed.source.createdAt
                        ? new Date(parsed.source.createdAt).toLocaleString()
                        : "None"}
                </dd>
                <dt className="text-muted-foreground">Messages</dt>
                <dd>{parsed.messages.length}</dd>
            </dl>

            {(dropped > 0 || repeatedRoleCount > 0 || parsed.parseWarnings.length > 0) && (
                <ul className="space-y-1 text-destructive">
                    {dropped > 0 && (
                        <li>
                            {dropped} empty message{dropped === 1 ? "" : "s"} will be dropped
                        </li>
                    )}
                    {repeatedRoleCount > 0 && (
                        <li>
                            {repeatedRoleCount === 1
                                ? "1 message repeats the previous role. Check the outlined role picker."
                                : `${repeatedRoleCount} messages repeat the previous role. Check the outlined role pickers.`}
                        </li>
                    )}
                    {parsed.parseWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                    ))}
                </ul>
            )}

            <ol className="space-y-2">
                {parsed.messages.map((message, index) => (
                    <li key={index} className="rounded-[var(--radius-md)] border bg-background p-2">
                        <p className="font-medium">
                            {message.role === "assistant" ? "Assistant" : "User"}
                            {message.metadata?.modelName && (
                                <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {message.metadata.modelName}
                                </span>
                            )}
                            {message.attachments.length > 0 && (
                                <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {message.attachments.length} attachment
                                    {message.attachments.length === 1 ? "" : "s"}
                                </span>
                            )}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                            {message.text || "(no text)"}
                        </p>
                    </li>
                ))}
            </ol>
        </div>
    )
}
