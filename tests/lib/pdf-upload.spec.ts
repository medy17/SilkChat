import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { describe, expect, it, vi } from "vitest"
import { prepareChatAttachmentForUpload, uploadChatAttachment } from "@/lib/chat-attachments"
import { DEFAULT_UPLOAD_POLICY } from "@/lib/file_constants"

// PDF.js requires its compatibility build under Node (including Promise.try).
// Both entries still run the real PDF parser, with the worker loaded from disk.
vi.mock("pdfjs-dist", () => import("pdfjs-dist/legacy/build/pdf.mjs"))
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
    default: pathToFileURL(
        createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
    ).href
}))

import { createPdf } from "../fixtures/pdf"

describe("PDF upload validation", () => {
    it("accepts PDFs at the 30-page boundary", async () => {
        const file = createPdf(30)
        await expect(prepareChatAttachmentForUpload(file)).resolves.toBe(file)
    })

    it.each([
        [31, "report.pdf", "application/pdf"],
        [200, "report.PDF", "application/octet-stream"],
        [31, "report", "application/x-pdf"]
    ])("rejects %i-page PDFs before reserving or uploading bytes", async (pages, name, type) => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        const prepareAndUpload = async () => {
            const file = await prepareChatAttachmentForUpload(createPdf(pages, name, type))
            return uploadChatAttachment({
                file,
                jwt: "jwt",
                uploadUrl: "https://example.com/upload"
            })
        }
        await expect(prepareAndUpload()).rejects.toThrow(
            `${name} has ${pages} pages. The maximum is 30`
        )
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("uses the policy limit and falls back to 30 for older cached policies", async () => {
        await expect(
            prepareChatAttachmentForUpload(createPdf(3), {
                ...DEFAULT_UPLOAD_POLICY,
                maxPdfPages: 2
            })
        ).rejects.toThrow("The maximum is 2")
        const policy = { ...DEFAULT_UPLOAD_POLICY }
        Reflect.deleteProperty(policy, "maxPdfPages")
        await expect(prepareChatAttachmentForUpload(createPdf(31), policy)).rejects.toThrow(
            "The maximum is 30"
        )
    })

    it("rejects unreadable PDFs and still accepts a subsequent valid file", async () => {
        await expect(
            prepareChatAttachmentForUpload(new File(["not a PDF"], "broken.pdf"))
        ).rejects.toThrow("Could not verify the PDF page count")
        const file = createPdf(1)
        await expect(prepareChatAttachmentForUpload(file)).resolves.toBe(file)
    })
})
