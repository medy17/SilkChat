import { describe, expect, it, vi } from "vitest"
import {
    readResponseBytesWithinLimit,
    validatePdfBytes
} from "../../convex/lib/pdf_validation_node"
import { createPdf } from "../fixtures/pdf"

vi.mock("../../convex/attachments", () => ({ r2: { store: vi.fn() } }))
import { r2 } from "../../convex/attachments"
import { mirrorRemoteAttachment } from "../../convex/import_jobs_mirror_node"
import type { ActionCtx } from "../../convex/_generated/server"

describe("server PDF validation", () => {
    it("accepts 30 pages and rejects 31 using the real PDFium parser", async () => {
        const accepted = new Uint8Array(await createPdf(30).arrayBuffer())
        await expect(validatePdfBytes(accepted, "report.pdf")).resolves.toMatchObject({
            pageCount: 30
        })
        const rejected = new Uint8Array(await createPdf(31).arrayBuffer())
        await expect(validatePdfBytes(rejected, "report.pdf")).rejects.toThrow("has 31 pages")
    })

    it("does not store a mirrored oversized PDF", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(createPdf(200))))
        await expect(
            mirrorRemoteAttachment({
                ctx: {} as ActionCtx,
                authorId: "user-1",
                url: "https://example.com/report.pdf",
                filename: "report.pdf"
            })
        ).rejects.toThrow("Conversations containing PDF attachments cannot be imported")
        expect(r2.store).not.toHaveBeenCalled()
    })

    it("rejects invalid PDFs and can validate a subsequent document", async () => {
        await expect(
            validatePdfBytes(new TextEncoder().encode("not a PDF"), "broken.pdf")
        ).rejects.toThrow("Could not verify the PDF page count")
        await expect(
            validatePdfBytes(new Uint8Array(await createPdf(1).arrayBuffer()), "ok.pdf")
        ).resolves.toMatchObject({ pageCount: 1 })
    })

    it("cancels downloads that exceed the cap even when Content-Length lies", async () => {
        const cancel = vi.fn()
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(4))
                controller.enqueue(new Uint8Array(4))
            },
            cancel
        })
        await expect(
            readResponseBytesWithinLimit(
                new Response(stream, {
                    headers: { "content-length": "2" }
                }),
                5
            )
        ).rejects.toThrow("File size exceeds")
        expect(cancel).toHaveBeenCalledOnce()
    })
})
