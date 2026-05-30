import { describe, expect, it } from "vitest"

import {
    getAttachmentValidationError,
    hasPdfAttachmentInMessages,
    hasPdfAttachmentInUploadedFiles,
    modelSupportsNativePdf
} from "@/lib/attachment-support"

describe("getAttachmentValidationError", () => {
    it("rejects pdf files when the model lacks native pdf support", () => {
        expect(
            getAttachmentValidationError(
                {
                    name: "report.pdf",
                    mimeType: "application/pdf",
                    size: 1024
                },
                {
                    supportsVision: true,
                    supportsNativePdf: false
                }
            )
        ).toBe("report.pdf: Current model doesn't support PDF files")
    })

    it("allows pdf files when the model has native pdf support", () => {
        expect(
            getAttachmentValidationError(
                {
                    name: "report.pdf",
                    mimeType: "application/pdf",
                    size: 1024
                },
                {
                    supportsVision: true,
                    supportsNativePdf: true
                }
            )
        ).toBeNull()
    })

    it("continues rejecting image files for non-vision models", () => {
        expect(
            getAttachmentValidationError(
                {
                    name: "diagram.png",
                    mimeType: "image/png",
                    size: 1024
                },
                {
                    supportsVision: false,
                    supportsNativePdf: true
                }
            )
        ).toBe("diagram.png: Current model doesn't support image files")
    })

    it("detects pdf uploads in draft attachments", () => {
        expect(
            hasPdfAttachmentInUploadedFiles([
                {
                    fileName: "report.pdf",
                    fileType: "application/pdf"
                }
            ])
        ).toBe(true)
    })

    it("detects pdf attachments already present in thread messages", () => {
        expect(
            hasPdfAttachmentInMessages([
                {
                    parts: [
                        {
                            type: "file",
                            url: "https://convex.example/r2?key=attachments%2Fuser-1%2Freport.pdf",
                            mediaType: "application/pdf"
                        }
                    ]
                }
            ])
        ).toBe(true)
    })

    it("checks models for native pdf support", () => {
        expect(modelSupportsNativePdf({ abilities: ["vision", "native_pdf"] })).toBe(true)
        expect(modelSupportsNativePdf({ abilities: ["vision"] })).toBe(false)
    })
})
