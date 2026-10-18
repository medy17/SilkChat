import { MAX_ATTACHMENTS_PER_THREAD } from "./file_constants"
import { PDF_IMPORT_ERROR } from "./import-attachment-policy"

export type AttachmentImportMode = "mirror" | "external" | "skip"

export type ImportRowStatus = "parsing" | "ready" | "importing" | "success" | "error" | "invalid"

/** One conversation in the import dialog, from the local queue or a background job. */
export interface ImportRow {
    id: string
    /** Rows from the same file share it, so they group under one file row. */
    sourceId: string
    sourceFileName: string
    title: string
    selected: boolean
    status: ImportRowStatus
    messageCount: number
    attachmentCount: number
    parseWarning?: string
    error?: string
    hasPdf?: boolean
    /** The markdown companion merged into a ChatGPT Exporter JSON row. */
    pairedFileName?: string
    failedAttachmentCount?: number
}

export interface ImportRowIssue {
    tone: "destructive" | "warning"
    label: string
    detail?: string
    /** The row can't be imported at all, so it can't be selected. */
    blocks: boolean
}

const shortParseError = (error?: string) =>
    !error
        ? "Unreadable file"
        : /no importable messages/i.test(error)
          ? "No messages found"
          : /json/i.test(error)
            ? "Not a valid JSON export"
            : error

const hasPdfAttachments = (row: ImportRow) => row.hasPdf || row.error === PDF_IMPORT_ERROR

/** The one actionable thing to say about a row. Parser notes are not issues. */
export const getImportRowIssue = (
    row: ImportRow,
    mode: AttachmentImportMode
): ImportRowIssue | undefined => {
    if (row.status === "invalid") {
        return {
            tone: "destructive",
            label: shortParseError(row.error),
            detail: row.error,
            blocks: true
        }
    }
    if (hasPdfAttachments(row) && row.status !== "success") {
        return {
            tone: "destructive",
            label: "Contains PDFs. Remove them from the export.",
            detail: PDF_IMPORT_ERROR,
            blocks: true
        }
    }
    if (row.status === "error") {
        return { tone: "destructive", label: row.error ?? "Import failed", blocks: false }
    }
    if (row.status === "success" && (row.failedAttachmentCount ?? 0) > 0) {
        return {
            tone: "warning",
            label: `${row.failedAttachmentCount} attachments not copied`,
            blocks: false
        }
    }
    if (
        mode === "mirror" &&
        row.status === "ready" &&
        row.attachmentCount > MAX_ATTACHMENTS_PER_THREAD
    ) {
        return {
            tone: "warning",
            label: `Copies the first ${MAX_ATTACHMENTS_PER_THREAD} of ${row.attachmentCount} attachments`,
            blocks: false
        }
    }
    return undefined
}

export const isImportRowSelectable = (row: ImportRow, mode: AttachmentImportMode) =>
    (row.status === "ready" || row.status === "error") && !getImportRowIssue(row, mode)?.blocks

export type ImportOutcome = "issues" | "ready" | "imported"

/** Which filter a row belongs to. Rows being read or sent belong only to All. */
export const getImportRowOutcome = (
    row: ImportRow,
    mode: AttachmentImportMode
): ImportOutcome | undefined =>
    getImportRowIssue(row, mode)?.tone === "destructive"
        ? "issues"
        : row.status === "success"
          ? "imported"
          : row.status === "ready"
            ? "ready"
            : undefined

export const countImportOutcomes = (rows: ImportRow[], mode: AttachmentImportMode) => {
    const counts: Record<ImportOutcome, number> = { issues: 0, ready: 0, imported: 0 }
    for (const row of rows) {
        const outcome = getImportRowOutcome(row, mode)
        if (outcome) counts[outcome] += 1
    }
    return counts
}

export interface ImportFileGroup<Row extends ImportRow = ImportRow> {
    sourceId: string
    fileName: string
    rows: Row[]
}

/** Groups rows by the file they came from, in the order the files first appear. */
export const groupImportRowsByFile = <Row extends ImportRow>(
    rows: Row[]
): ImportFileGroup<Row>[] => {
    const groups = new Map<string, ImportFileGroup<Row>>()
    for (const row of rows) {
        const group = groups.get(row.sourceId)
        if (group) {
            group.rows.push(row)
        } else {
            groups.set(row.sourceId, {
                sourceId: row.sourceId,
                fileName: row.sourceFileName,
                rows: [row]
            })
        }
    }
    return [...groups.values()]
}

export interface ImportQueueSummary {
    selectable: number
    parsing: number
    imported: number
    /** Selected rows that Import would send. */
    toImport: number
    /** Selected rows that failed before and would be sent again. */
    retryable: number
    /** Settled out of everything sent, while an import runs. */
    progress?: { done: number; total: number }
}

export const summarizeImportQueue = (
    rows: ImportRow[],
    mode: AttachmentImportMode,
    isImporting: boolean
): ImportQueueSummary => {
    const selectable = rows.filter((row) => isImportRowSelectable(row, mode))
    const selected = selectable.filter((row) => row.selected)
    const imported = rows.filter((row) => row.status === "success").length
    const failed = rows.filter((row) => row.status === "error").length
    const importing = rows.filter((row) => row.status === "importing").length
    const queued = selected.filter((row) => row.status === "ready").length

    return {
        selectable: selectable.length,
        parsing: rows.filter((row) => row.status === "parsing").length,
        imported,
        toImport: selected.length,
        retryable: selected.filter((row) => row.status === "error").length,
        progress: isImporting
            ? { done: imported + failed, total: imported + failed + importing + queued }
            : undefined
    }
}

/** Checkbox state for a set of rows, counting only rows that can be selected. */
export const getImportSelectionState = (rows: ImportRow[], mode: AttachmentImportMode) => {
    const selectable = rows.filter((row) => isImportRowSelectable(row, mode))
    const selected = selectable.filter((row) => row.selected).length
    return {
        ids: new Set(selectable.map((row) => row.id)),
        selected,
        checked:
            selectable.length > 0 && selected === selectable.length
                ? (true as const)
                : selected > 0
                  ? ("indeterminate" as const)
                  : (false as const),
        disabled: selectable.length === 0
    }
}
