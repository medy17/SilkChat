import { describe, expect, it } from "vitest"
import { isImportedPdf } from "@/lib/import-attachment-policy"

describe("PDF import rejection", () => {
    it.each([
        { filename: "Report.PDF" },
        { filename: "download", url: "https://example.com/report%2Epdf?signature=abc" },
        { filename: "notes.txt", mimeType: "Application/PDF; charset=binary" },
        { filename: "download", mimeType: "application/x-pdf" },
        { url: "https://example.com/r2?key=attachments%2Fuser%2Freport.pdf" },
        { url: "data:application/pdf;base64,abc" }
    ])("recognizes a PDF reference: %j", (attachment) => {
        expect(isImportedPdf(attachment)).toBe(true)
    })

    it("allows other attachment types", () => {
        expect(isImportedPdf({ filename: "notes.md", url: "https://example.com/notes.md" })).toBe(
            false
        )
        expect(isImportedPdf({ filename: "photo.png", mimeType: "image/png" })).toBe(false)
    })
})
