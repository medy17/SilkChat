import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MAX_ATTACHMENTS_PER_THREAD } from "@/lib/file_constants"
import {
    type AttachmentImportMode,
    type ImportFileGroup,
    type ImportOutcome,
    type ImportRow,
    getImportRowIssue,
    getImportSelectionState,
    isImportRowSelectable
} from "@/lib/thread-import-presentation"
import { cn } from "@/lib/utils"
import {
    ArrowUpRight,
    Check,
    ChevronRight,
    CircleAlert,
    Clock3,
    FileText,
    FileUp,
    Info,
    Link2,
    Loader2,
    MessageSquare,
    Paperclip,
    Plus,
    X
} from "lucide-react"
import { type ReactNode, useState } from "react"
import type { Project } from "./types"

export const NO_FOLDER = "no-folder"

const ATTACHMENT_MODES: Array<{ value: AttachmentImportMode; label: string; hint: string }> = [
    { value: "external", label: "Link", hint: "Fastest. Links can break later." },
    {
        value: "mirror",
        label: "Copy",
        hint: `Slowest. Up to ${MAX_ATTACHMENTS_PER_THREAD} per conversation.`
    },
    { value: "skip", label: "Skip", hint: "Messages only." }
]

const OUTCOME_LABELS: Record<ImportOutcome | "all", string> = {
    all: "All",
    issues: "Issues",
    ready: "Ready",
    imported: "Imported"
}

const optionLabel = "text-[0.625rem] text-muted-foreground uppercase tracking-wider"

/** Folder and attachment handling as two flat columns above the list. */
export function ImportSettingsRow({
    projectId,
    onProjectIdChange,
    projects,
    onCreateFolder,
    mode,
    onModeChange,
    disabled
}: {
    projectId: string
    onProjectIdChange: (projectId: string) => void
    projects: Project[]
    onCreateFolder: () => void
    mode: AttachmentImportMode
    onModeChange: (mode: AttachmentImportMode) => void
    disabled?: boolean
}) {
    const [folderSelectOpen, setFolderSelectOpen] = useState(false)
    return (
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <div className="flex min-w-0 flex-col gap-2">
                <span className={optionLabel}>Folder</span>
                <Select
                    open={folderSelectOpen}
                    onOpenChange={setFolderSelectOpen}
                    value={projectId}
                    onValueChange={onProjectIdChange}
                    disabled={disabled}
                >
                    <SelectTrigger size="sm" className="w-full" aria-label="Folder">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[80]">
                        <SelectItem value={NO_FOLDER}>General</SelectItem>
                        {projects.map((project) => (
                            <SelectItem key={project._id} value={project._id}>
                                {project.name}
                            </SelectItem>
                        ))}
                        <SelectSeparator />
                        <button
                            type="button"
                            className="flex w-full cursor-default select-none items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-primary text-sm outline-hidden hover:bg-accent focus:bg-accent"
                            onPointerDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                            }}
                            onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                setFolderSelectOpen(false)
                                onCreateFolder()
                            }}
                        >
                            <Plus className="size-4" />
                            <span>Create Folder</span>
                        </button>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
                <span className={optionLabel}>Attachments</span>
                <Tabs
                    value={mode}
                    onValueChange={(value) => onModeChange(value as AttachmentImportMode)}
                >
                    <TabsList className="h-8 w-full" aria-label="Attachments">
                        {ATTACHMENT_MODES.map((option) => (
                            <TabsTrigger
                                key={option.value}
                                value={option.value}
                                disabled={disabled}
                                title={option.hint}
                                className="px-2 text-xs"
                            >
                                {option.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>
        </div>
    )
}

/** A thin bar along the bottom edge of the list header that fills with progress. */
export function ImportProgressEdge({ value, settled }: { value?: number; settled?: boolean }) {
    if (value === undefined) return null
    return (
        <div
            aria-hidden="true"
            className={cn(
                "absolute bottom-0 left-0 h-0.5 w-full origin-left transition-transform duration-700 ease-out",
                settled ? "bg-muted-foreground/40" : "bg-primary"
            )}
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }}
        />
    )
}

/** Drop-target veil. It covers the list instead of inserting a row, so nothing shifts. */
export function ImportDropVeil({ active }: { active: boolean }) {
    if (!active) return null
    return (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-primary border-dashed bg-background/85 font-medium text-primary text-sm">
            <span className="inline-flex items-center gap-2">
                <FileUp className="size-4" aria-hidden="true" />
                Drop to add
            </span>
        </div>
    )
}

export function ImportEmptyState({
    onBrowse,
    disabled,
    isMobile
}: {
    onBrowse: () => void
    disabled?: boolean
    isMobile: boolean
}) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
            <div className="space-y-1">
                <p className="font-medium text-sm">
                    {isMobile ? "Choose export files" : "Drop exports here"}
                </p>
                <p className="text-muted-foreground text-xs">.md · .txt · .json</p>
            </div>
            <Button
                size="sm"
                variant="outline"
                className="rounded-[var(--radius-md)]"
                onClick={onBrowse}
                disabled={disabled}
            >
                Browse
            </Button>
        </div>
    )
}

/** The list header: select-all, then either the outcome filter or a plain count. */
export function ImportListHeader({
    selection,
    onToggleAll,
    locked,
    filter,
    label,
    status,
    onAddFiles,
    progress,
    settled
}: {
    selection?: ReturnType<typeof getImportSelectionState>
    onToggleAll?: (selected: boolean) => void
    locked?: boolean
    filter?: ReactNode
    label: ReactNode
    status?: ReactNode
    onAddFiles?: () => void
    progress?: number
    settled?: boolean
}) {
    return (
        <div className="relative flex h-11 shrink-0 items-center gap-3 border-b pr-1.5">
            <div className="ml-3 flex min-w-0 items-center gap-3">
                {selection && (
                    <span className="flex size-5 shrink-0 items-center justify-center">
                        <Checkbox
                            checked={selection.checked}
                            disabled={selection.disabled || locked}
                            onCheckedChange={(checked) => onToggleAll?.(checked === true)}
                            aria-label="Select all"
                        />
                    </span>
                )}
                {filter ?? <span className="truncate text-sm tabular-nums">{label}</span>}
            </div>
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
                {status}
            </span>
            {onAddFiles && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 rounded-[var(--radius-md)]"
                    disabled={locked}
                    onClick={onAddFiles}
                    title="Add files"
                    aria-label="Add files"
                >
                    <Plus className="size-4" />
                </Button>
            )}
            <ImportProgressEdge value={progress} settled={settled} />
        </div>
    )
}

/** Outcome filter. Its counts replace the separate Ready, Imported, and Issues counters. */
export function ImportOutcomeFilter({
    value,
    onValueChange,
    total,
    counts
}: {
    value: ImportOutcome | "all"
    onValueChange: (value: ImportOutcome | "all") => void
    total: number
    counts: Record<ImportOutcome, number>
}) {
    const outcomes = (["issues", "ready", "imported"] as const).filter((key) => counts[key] > 0)
    return (
        <Tabs
            value={value}
            onValueChange={(next) => onValueChange(next as ImportOutcome | "all")}
            className="min-w-0"
        >
            <TabsList className="h-7" aria-label="Show">
                {(["all", ...outcomes] as const).map((key) => (
                    <TabsTrigger
                        key={key}
                        value={key}
                        className={cn(
                            "gap-1 px-2 text-xs",
                            key === "issues" && "text-destructive dark:text-destructive"
                        )}
                    >
                        {OUTCOME_LABELS[key]}
                        <span className="text-muted-foreground tabular-nums">
                            {key === "all" ? total : counts[key]}
                        </span>
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    )
}

/** Whether the outcome filter has anything to filter. */
export const shouldShowOutcomeFilter = (total: number, counts: Record<ImportOutcome, number>) => {
    const present = (["issues", "ready", "imported"] as const).filter((key) => counts[key] > 0)
    return present.length > 1 || (present.length === 1 && counts[present[0]] < total)
}

function RowCounts({ row }: { row: ImportRow }) {
    if (row.status === "parsing") return null
    return (
        <span className="ml-auto inline-flex shrink-0 items-center gap-2.5 text-muted-foreground text-xs tabular-nums">
            <span className="inline-flex items-center gap-1" title={`${row.messageCount} messages`}>
                <MessageSquare className="size-3" aria-hidden="true" />
                {row.messageCount}
            </span>
            {row.attachmentCount > 0 && (
                <span
                    className="inline-flex items-center gap-1"
                    title={`${row.attachmentCount} attachments`}
                >
                    <Paperclip className="size-3" aria-hidden="true" />
                    {row.attachmentCount}
                </span>
            )}
        </span>
    )
}

const removeButtonClass =
    "flex size-5 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground opacity-0 transition-[opacity,background-color] hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"

/**
 * One conversation. The leading slot is its only status: a checkbox while it can be chosen, a
 * spinner while it is read or sent, a check once imported, an alert when it can't be imported.
 * The trailing slot holds the one action that fits the state.
 */
export function ImportConversationRow({
    row,
    mode,
    selectable = true,
    locked,
    inset,
    onToggle,
    onRemove,
    onOpen
}: {
    row: ImportRow
    mode: AttachmentImportMode
    /** False in a background job, where nothing is chosen. */
    selectable?: boolean
    locked?: boolean
    inset?: boolean
    onToggle?: (selected: boolean) => void
    onRemove?: () => void
    onOpen?: () => void
}) {
    const issue = getImportRowIssue(row, mode)
    const blocked = issue?.blocks ?? false
    const canSelect = selectable && isImportRowSelectable(row, mode)
    const busy = row.status === "parsing" || row.status === "importing"
    const done = row.status === "success"
    const note = row.parseWarning && !row.pairedFileName ? row.parseWarning : undefined

    const leading = busy ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Working" />
    ) : done ? (
        <Check className="size-4 text-primary" aria-label="Imported" />
    ) : blocked ? (
        <CircleAlert className="size-4 text-destructive" aria-label="Can't import" />
    ) : canSelect ? (
        <Checkbox
            checked={row.selected}
            disabled={locked}
            onCheckedChange={(checked) => onToggle?.(checked === true)}
            aria-label={`Import ${row.title}`}
        />
    ) : row.status === "error" ? (
        <CircleAlert className="size-4 text-destructive" aria-label="Failed" />
    ) : (
        <Clock3 className="size-3.5 text-muted-foreground" aria-label="Queued" />
    )

    return (
        <div
            className={cn(
                "group flex items-start gap-3 px-3 py-2.5",
                inset && "pl-10",
                (blocked || (canSelect && !row.selected)) && "text-muted-foreground"
            )}
        >
            <span className="flex size-5 shrink-0 items-center justify-center">{leading}</span>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span
                        className={cn("truncate text-sm", done && "text-muted-foreground")}
                        title={row.title}
                    >
                        {row.status === "parsing" ? row.sourceFileName : row.title}
                    </span>
                    {row.pairedFileName && (
                        <span title={`Paired with ${row.pairedFileName}`} className="shrink-0">
                            <Link2 className="size-3 text-muted-foreground" aria-hidden="true" />
                        </span>
                    )}
                    {note && (
                        <span title={note} className="shrink-0">
                            <Info className="size-3 text-muted-foreground" aria-hidden="true" />
                        </span>
                    )}
                    <RowCounts row={row} />
                </div>
                {issue && (
                    <p
                        className={cn(
                            "mt-0.5 truncate text-xs",
                            issue.tone === "destructive" ? "text-destructive" : "text-warning"
                        )}
                        title={issue.detail ?? issue.label}
                    >
                        {issue.label}
                    </p>
                )}
            </div>
            <span className="flex size-5 shrink-0 items-center justify-center">
                {done && onOpen ? (
                    <button
                        type="button"
                        onClick={onOpen}
                        className="flex size-5 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Open"
                        aria-label={`Open ${row.title}`}
                    >
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </button>
                ) : onRemove && !busy && !locked ? (
                    <button
                        type="button"
                        onClick={onRemove}
                        className={removeButtonClass}
                        title="Remove"
                        aria-label={`Remove ${row.title}`}
                    >
                        <X className="size-3.5" aria-hidden="true" />
                    </button>
                ) : null}
            </span>
        </div>
    )
}

/**
 * A file and the conversations it holds. Small files and files with issues start open; large
 * exports start as one row.
 */
export function ImportFileGroupRows<Row extends ImportRow>({
    group,
    mode,
    expanded,
    onToggleExpanded,
    selectable,
    locked,
    count,
    error,
    status,
    onToggleMany,
    onRemoveGroup,
    renderRow
}: {
    group: ImportFileGroup<Row>
    mode: AttachmentImportMode
    expanded: boolean
    onToggleExpanded: () => void
    selectable: boolean
    locked?: boolean
    /** Conversations in the file, when it differs from the rows on hand. */
    count?: number
    error?: string
    /** Overrides the leading status, for job sources. */
    status?: ReactNode
    onToggleMany?: (ids: Set<string>, selected: boolean) => void
    onRemoveGroup?: () => void
    renderRow: (row: Row) => ReactNode
}) {
    const selection = getImportSelectionState(group.rows, mode)
    const issues = group.rows.filter(
        (row) => getImportRowIssue(row, mode)?.tone === "destructive"
    ).length
    const busy = group.rows.some((row) => row.status === "parsing" || row.status === "importing")
    const allImported = group.rows.length > 0 && group.rows.every((row) => row.status === "success")
    const hasRows = group.rows.length > 0

    const leading =
        status ??
        (busy ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Working" />
        ) : allImported ? (
            <Check className="size-4 text-primary" aria-label="Imported" />
        ) : selectable && !selection.disabled ? (
            <Checkbox
                checked={selection.checked}
                disabled={locked}
                onCheckedChange={(checked) => onToggleMany?.(selection.ids, checked === true)}
                aria-label={`Import all from ${group.fileName}`}
            />
        ) : (
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
        ))

    return (
        <div>
            <div className="group flex items-start gap-3 px-3 py-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center">{leading}</span>
                <button
                    type="button"
                    onClick={onToggleExpanded}
                    disabled={!hasRows}
                    className="flex min-w-0 flex-1 flex-col items-stretch text-left disabled:cursor-default"
                    aria-expanded={hasRows ? expanded : undefined}
                >
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium text-sm">{group.fileName}</span>
                        {hasRows && (
                            <ChevronRight
                                className={cn(
                                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                    expanded && "rotate-90"
                                )}
                                aria-hidden="true"
                            />
                        )}
                        <span className="ml-auto inline-flex shrink-0 items-center gap-2.5 text-xs tabular-nums">
                            {issues > 0 && (
                                <span className="inline-flex items-center gap-1 text-destructive">
                                    <CircleAlert className="size-3" aria-hidden="true" />
                                    {issues}
                                </span>
                            )}
                            <span className="text-muted-foreground">
                                {selectable && selection.checked === "indeterminate"
                                    ? `${selection.selected} of ${group.rows.length}`
                                    : (count ?? group.rows.length)}
                            </span>
                        </span>
                    </span>
                    {error && (
                        <span className="mt-0.5 truncate text-destructive text-xs" title={error}>
                            {error}
                        </span>
                    )}
                </button>
                <span className="flex size-5 shrink-0 items-center justify-center">
                    {onRemoveGroup && !busy && !locked && (
                        <button
                            type="button"
                            onClick={onRemoveGroup}
                            className={removeButtonClass}
                            title="Remove file"
                            aria-label={`Remove ${group.fileName}`}
                        >
                            <X className="size-3.5" aria-hidden="true" />
                        </button>
                    )}
                </span>
            </div>
            {expanded && group.rows.map(renderRow)}
        </div>
    )
}
