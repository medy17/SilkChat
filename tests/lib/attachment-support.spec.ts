import { describe, expect, it } from "vitest"

import {
    getAttachmentValidationError,
    hasPdfAttachmentInMessages,
    hasPdfAttachmentInUploadedFiles,
    hasVisionImageAttachmentInMessages,
    modelSupportsNativePdf,
    modelSupportsVision
} from "@/lib/attachment-support"
import { MAX_ATTACHMENTS_PER_THREAD, MAX_FILE_SIZE, isSupportedFile } from "@/lib/file_constants"

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

    it("allows AVIF images for vision models", () => {
        expect(isSupportedFile("diagram.avif", "image/avif")).toBe(true)
        expect(
            getAttachmentValidationError(
                {
                    name: "diagram.avif",
                    mimeType: "image/avif",
                    size: 1024
                },
                {
                    supportsVision: true,
                    supportsNativePdf: true
                }
            )
        ).toBeNull()
    })

    it("rejects oversized images before adding them to the upload queue", () => {
        expect(
            getAttachmentValidationError(
                {
                    name: "oversized.png",
                    mimeType: "image/png",
                    size: MAX_FILE_SIZE + 1
                },
                {
                    supportsVision: true,
                    supportsNativePdf: true
                }
            )
        ).toBe("oversized.png: File size exceeds 15MB limit")
    })

    it.each(["report.docx", "slides.pptx", "workbook.xlsx", "notes.odt", "data.ods", "deck.odp"])(
        "accepts browser-convertible document format %s",
        (name) => {
            expect(isSupportedFile(name)).toBe(true)
            expect(
                getAttachmentValidationError(
                    { name, size: 1024 },
                    { supportsVision: false, supportsNativePdf: false }
                )
            ).toBeNull()
        }
    )

    it.each(["legacy.xls", "macros.xlsm", "binary.xlsb", "slideshow.ppsx", "macros.docm"])(
        "rejects document format %s when the browser converter does not support it",
        (name) => {
            expect(isSupportedFile(name)).toBe(false)
            expect(
                getAttachmentValidationError(
                    { name, size: 1024 },
                    { supportsVision: false, supportsNativePdf: false }
                )
            ).toContain("Unsupported file type")
        }
    )

    it("uses the configured attachment limits", () => {
        expect(MAX_FILE_SIZE).toBe(15 * 1024 * 1024)
        expect(MAX_ATTACHMENTS_PER_THREAD).toBe(100)
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

    it("detects vision images already present in thread messages", () => {
        expect(
            hasVisionImageAttachmentInMessages([
                {
                    parts: [
                        {
                            type: "file",
                            url: "https://convex.example/r2?key=attachments%2Fuser-1%2Fdiagram.png",
                            mediaType: "image/png"
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

    it("checks models for vision support", () => {
        expect(modelSupportsVision({ abilities: ["vision", "native_pdf"] })).toBe(true)
        expect(modelSupportsVision({ abilities: ["native_pdf"] })).toBe(false)
    })
})
