"use node"

import { PDFiumLibrary } from "@hyzyla/pdfium"
import { MAX_FILE_SIZE, MAX_PDF_PAGES, formatFileSizeLimit } from "@/lib/file_constants"

export class FileSizeLimitError extends Error {}

export const readResponseBytesWithinLimit = async (response: Response, maxBytes: number) => {
    const sizeError = () =>
        new FileSizeLimitError(`File size exceeds ${formatFileSizeLimit(maxBytes)} limit`)
    if (Number(response.headers.get("content-length")) > maxBytes) {
        await response.body?.cancel().catch(() => {})
        throw sizeError()
    }
    if (!response.body) throw new Error("Attachment download returned an empty body")

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > maxBytes) {
                await reader.cancel().catch(() => {})
                throw sizeError()
            }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }

    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    return bytes
}

export class PdfContentError extends Error {}

export const inspectPdfBytes = async (bytes: Uint8Array, fileName: string) => {
    if (bytes.byteLength > MAX_FILE_SIZE) {
        throw new FileSizeLimitError(
            `${fileName}: File size exceeds ${formatFileSizeLimit(MAX_FILE_SIZE)} limit`
        )
    }
    const startedAt = performance.now()
    const rssBeforeBytes = process.memoryUsage().rss
    // Use a fresh instance so documents cannot retain a grown heap across validations.
    const library = await PDFiumLibrary.init()
    let document: Awaited<ReturnType<typeof library.loadDocument>> | undefined
    let pageCount: number
    try {
        document = await library.loadDocument(bytes)
        pageCount = document.getPageCount()
    } catch {
        throw new PdfContentError(
            `${fileName}: Could not verify the PDF page count. Use a readable, unencrypted PDF`
        )
    } finally {
        document?.destroy()
        library.destroy()
    }

    const measurement = {
        pageCount,
        fileSizeBytes: bytes.byteLength,
        durationMs: Math.round(performance.now() - startedAt),
        rssBeforeBytes,
        rssAfterBytes: process.memoryUsage().rss,
        processPeakRssBytes: process.resourceUsage().maxRSS * 1024
    }
    console.info("[pdf-validation]", measurement)
    if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
        throw new PdfContentError(`${fileName}: Could not verify the PDF page count`)
    }
    return measurement
}

export const assertPdfPageCount = (pageCount: number, fileName: string) => {
    if (pageCount > MAX_PDF_PAGES) {
        throw new Error(
            `${fileName} has ${pageCount} pages. The maximum is ${MAX_PDF_PAGES}. Split the PDF and try again`
        )
    }
}

export const validatePdfBytes = async (bytes: Uint8Array, fileName: string) => {
    const measurement = await inspectPdfBytes(bytes, fileName)
    assertPdfPageCount(measurement.pageCount, fileName)
    return measurement
}
