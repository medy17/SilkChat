import { describe, expect, it } from "vitest"

import {
    decodeInlineDocumentDataUrl,
    getClientDocumentContextMetadata
} from "@/lib/document-context"
import {
    createInlineDocumentDataUrl,
    getDocumentSourceMetadata,
    wrapConvertedDocument
} from "@/lib/document-conversion"

describe("client document conversion", () => {
    it("recognizes Microsoft and OpenDocument source metadata", () => {
        expect(
            getDocumentSourceMetadata({
                name: "Agreement.docx",
                type: "",
                size: 1234
            } as File)
        ).toEqual({
            format: "docx",
            mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sizeBytes: 1234
        })

        expect(
            getDocumentSourceMetadata({ name: "Budget.ods", type: "", size: 42 } as File)
        ).toEqual({
            format: "ods",
            mediaType: "application/vnd.oasis.opendocument.spreadsheet",
            sizeBytes: 42
        })

        expect(
            getDocumentSourceMetadata({ name: "Legacy.xls", type: "", size: 42 } as File)
        ).toBeNull()
    })

    it("wraps converted Markdown with safe filename and source metadata", () => {
        expect(
            wrapConvertedDocument({
                fileName: 'Board & "Legal".pptx',
                sourceFormat: "pptx",
                sourceMediaType:
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                sourceSizeBytes: 2048,
                markdown: "## Agenda\n\n- Review"
            })
        ).toBe(
            '<file name="Board &amp; &quot;Legal&quot;.pptx" source-format="pptx" source-media-type="application/vnd.openxmlformats-officedocument.presentationml.presentation" source-size-bytes="2048" converted-by="anydoc-wasm">\n## Agenda\n\n- Review\n</file>'
        )
    })

    it("packages inline document context as a client-owned Markdown data URL", async () => {
        const content =
            '<file name="slides.pptx" source-size-bytes="2048" converted-by="anydoc-wasm">\n# Slides & notes\n</file>'
        const dataUrl = createInlineDocumentDataUrl(content)

        expect(dataUrl).toMatch(/^data:text\/markdown;charset=utf-8,/)
        expect(decodeInlineDocumentDataUrl(dataUrl)).toBe(content)
        expect(getClientDocumentContextMetadata(content)).toEqual({
            fileName: "slides.pptx",
            sourceSizeBytes: 2048
        })
        await expect(fetch(dataUrl).then((response) => response.text())).resolves.toBe(content)
    })
})
