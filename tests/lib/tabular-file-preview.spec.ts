import { describe, expect, it } from "vitest"
import {
    TABULAR_PREVIEW_MAX_ROWS,
    getTabularDelimiter,
    isTabularTextFile,
    parseDelimitedTextPreview,
    truncateTextPreview
} from "../../src/lib/tabular-file-preview"

describe("tabular file preview", () => {
    it("recognizes CSV and TSV by filename or media type", () => {
        expect(isTabularTextFile("report.csv", "application/octet-stream")).toBe(true)
        expect(isTabularTextFile("report.data", "text/tab-separated-values; charset=utf-8")).toBe(
            true
        )
        expect(isTabularTextFile("report.pdf", "application/pdf")).toBe(false)
        expect(getTabularDelimiter("report.tsv", "text/plain")).toBe("\t")
    })

    it("parses quoted delimiters, escaped quotes, and multiline cells", () => {
        expect(
            parseDelimitedTextPreview(
                '\uFEFFname,notes,value\r\n"Ada, A.","said ""hello""\nagain",42\r\n',
                ","
            )
        ).toEqual({
            rows: [
                ["name", "notes", "value"],
                ["Ada, A.", 'said "hello"\nagain', "42"]
            ],
            truncated: false
        })
    })

    it("bounds rows, columns, and cell content", () => {
        expect(
            parseDelimitedTextPreview("a,b,c\n12345,2,3\nlast,row,ignored", ",", {
                maxRows: 2,
                maxColumns: 2,
                maxCellChars: 3
            })
        ).toEqual({
            rows: [
                ["a", "b"],
                ["123", "2"]
            ],
            truncated: true
        })
    })

    it("stops parsing after the default preview row limit", () => {
        const input = Array.from(
            { length: TABULAR_PREVIEW_MAX_ROWS + 50 },
            (_, index) => `${index},value-${index}`
        ).join("\n")

        const preview = parseDelimitedTextPreview(input, ",")

        expect(preview.rows).toHaveLength(TABULAR_PREVIEW_MAX_ROWS)
        expect(preview.rows.at(-1)).toEqual(["199", "value-199"])
        expect(preview.truncated).toBe(true)
    })

    it("only truncates plain text after its preview limits", () => {
        expect(truncateTextPreview("one\ntwo", { maxLines: 2, maxChars: 100 })).toEqual({
            content: "one\ntwo",
            truncated: false
        })
        expect(truncateTextPreview("one\ntwo\nthree", { maxLines: 2, maxChars: 100 })).toEqual({
            content: "one\ntwo",
            truncated: true
        })
        expect(truncateTextPreview("abcdefghij", { maxLines: 20, maxChars: 5 })).toEqual({
            content: "abcde",
            truncated: true
        })
    })
})
