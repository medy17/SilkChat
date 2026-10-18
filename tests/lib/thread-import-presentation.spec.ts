import { describe, expect, it } from "vitest"
import { MAX_ATTACHMENTS_PER_THREAD } from "@/lib/file_constants"
import { PDF_IMPORT_ERROR } from "@/lib/import-attachment-policy"
import {
    type ImportRow,
    countImportOutcomes,
    getImportRowIssue,
    getImportSelectionState,
    groupImportRowsByFile,
    isImportRowSelectable,
    summarizeImportQueue
} from "@/lib/thread-import-presentation"

const row = (overrides: Partial<ImportRow> = {}): ImportRow => ({
    id: overrides.id ?? "row",
    sourceId: "file-a",
    sourceFileName: "a.json",
    title: "A conversation",
    selected: true,
    status: "ready",
    messageCount: 12,
    attachmentCount: 0,
    ...overrides
})

describe("import row issues", () => {
    it("blocks conversations with PDFs before import, whether flagged at parse or by the server", () => {
        for (const blocked of [
            row({ hasPdf: true }),
            row({ status: "error", error: PDF_IMPORT_ERROR })
        ]) {
            expect(getImportRowIssue(blocked, "external")?.blocks).toBe(true)
            expect(isImportRowSelectable(blocked, "external")).toBe(false)
        }
    })

    it("lets a failed import be retried", () => {
        const failed = row({ status: "error", error: "Import failed" })
        expect(getImportRowIssue(failed, "external")).toMatchObject({
            tone: "destructive",
            blocks: false
        })
        expect(isImportRowSelectable(failed, "external")).toBe(true)
    })

    it("warns about the attachment cap only when copying attachments", () => {
        const heavy = row({ attachmentCount: MAX_ATTACHMENTS_PER_THREAD + 40 })
        expect(getImportRowIssue(heavy, "mirror")?.tone).toBe("warning")
        expect(getImportRowIssue(heavy, "external")).toBeUndefined()
        expect(isImportRowSelectable(heavy, "mirror")).toBe(true)
    })

    it("does not treat parser notes as issues", () => {
        expect(
            getImportRowIssue(
                row({ parseWarning: "Skipped personal metadata fields from JSON export" }),
                "external"
            )
        ).toBeUndefined()
    })
})

describe("import list grouping and counts", () => {
    it("groups conversations under their file in first-seen order", () => {
        const groups = groupImportRowsByFile([
            row({ id: "1", sourceId: "export", sourceFileName: "export.json" }),
            row({ id: "2", sourceId: "single", sourceFileName: "single.md" }),
            row({ id: "3", sourceId: "export", sourceFileName: "export.json" })
        ])
        expect(groups.map((group) => [group.fileName, group.rows.map((item) => item.id)])).toEqual([
            ["export.json", ["1", "3"]],
            ["single.md", ["2"]]
        ])
    })

    it("counts each row under one outcome and leaves in-flight rows out", () => {
        const counts = countImportOutcomes(
            [
                row({ id: "ready" }),
                row({ id: "pdf", hasPdf: true }),
                row({ id: "invalid", status: "invalid" }),
                row({ id: "done", status: "success" }),
                row({ id: "busy", status: "importing" })
            ],
            "external"
        )
        expect(counts).toEqual({ issues: 2, ready: 1, imported: 1 })
    })

    it("selects all without selecting blocked rows", () => {
        const rows = [
            row({ id: "ok", selected: false }),
            row({ id: "pdf", hasPdf: true, selected: false })
        ]
        const selection = getImportSelectionState(rows, "external")
        expect([...selection.ids]).toEqual(["ok"])
        expect(selection.checked).toBe(false)
    })
})

describe("import queue summary", () => {
    it("reports progress over everything sent while importing", () => {
        const summary = summarizeImportQueue(
            [
                row({ id: "1", status: "success", selected: false }),
                row({ id: "2", status: "error" }),
                row({ id: "3", status: "importing" }),
                row({ id: "4" }),
                row({ id: "5", selected: false })
            ],
            "external",
            true
        )
        expect(summary.progress).toEqual({ done: 2, total: 4 })
    })

    it("offers a retry only for selected failures", () => {
        const summary = summarizeImportQueue(
            [
                row({ id: "1", status: "success", selected: false }),
                row({ id: "2", status: "error" })
            ],
            "external",
            false
        )
        expect(summary).toMatchObject({ toImport: 1, retryable: 1, imported: 1 })
        expect(summary.progress).toBeUndefined()
    })
})
