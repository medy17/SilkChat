import { describe, expect, it } from "vitest"
import {
    getTabularDelimiter,
    isTabularTextFile,
    parseDelimitedTextPreview
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
})
