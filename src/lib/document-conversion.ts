import {
    DOCUMENT_MIME_TYPES_BY_EXTENSION,
    MAX_TOKENS_PER_FILE,
    estimateTokenCount,
    isDocumentExtension
} from "@/lib/file_constants"
export { createInlineDocumentDataUrl } from "@/lib/document-context"

export type ConvertedDocument = {
    file: File
    content: string
    estimatedTokens: number
    sourceFormat: string
    sourceMediaType: string
}

type WorkerSuccess = { ok: true; markdown: string }
type WorkerFailure = { ok: false; message: string; code?: string }

const escapeTagAttribute = (value: string) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")

export const getDocumentSourceMetadata = (file: Pick<File, "name" | "type" | "size">) => {
    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
    if (!extension || !isDocumentExtension(file.name)) return null

    return {
        format: extension.slice(1),
        mediaType:
            DOCUMENT_MIME_TYPES_BY_EXTENSION[extension] || file.type || "application/octet-stream",
        sizeBytes: file.size
    }
}

export const wrapConvertedDocument = ({
    fileName,
    sourceFormat,
    sourceMediaType,
    sourceSizeBytes,
    markdown
}: {
    fileName: string
    sourceFormat: string
    sourceMediaType: string
    sourceSizeBytes: number
    markdown: string
}) =>
    `<file name="${escapeTagAttribute(fileName)}" source-format="${escapeTagAttribute(sourceFormat)}" source-media-type="${escapeTagAttribute(sourceMediaType)}" source-size-bytes="${sourceSizeBytes}" converted-by="anydoc-wasm">\n${markdown.trim()}\n</file>`

const convertInWorker = (bytes: ArrayBuffer, format: string) =>
    new Promise<string>((resolve, reject) => {
        const worker = new Worker(new URL("./document-conversion.worker.ts", import.meta.url), {
            type: "module"
        })

        worker.onmessage = (event: MessageEvent<WorkerSuccess | WorkerFailure>) => {
            worker.terminate()
            if (event.data.ok) resolve(event.data.markdown)
            else reject(new Error(event.data.message))
        }
        worker.onerror = (event) => {
            worker.terminate()
            reject(new Error(event.message || "Document conversion failed"))
        }
        worker.postMessage({ bytes, format }, [bytes])
    })

export const convertDocumentToMarkdownFile = async (file: File): Promise<ConvertedDocument> => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
        throw new Error("Document conversion is only available in the browser")
    }

    const metadata = getDocumentSourceMetadata(file)
    if (!metadata) throw new Error(`${file.name}: Unsupported document format`)

    let markdown: string
    try {
        markdown = await convertInWorker(await file.arrayBuffer(), metadata.format)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Document conversion failed"
        throw new Error(`${file.name}: ${message}`)
    }
    const content = wrapConvertedDocument({
        fileName: file.name,
        sourceFormat: metadata.format,
        sourceMediaType: metadata.mediaType,
        sourceSizeBytes: metadata.sizeBytes,
        markdown
    })
    const estimatedTokens = estimateTokenCount(content)
    if (estimatedTokens > MAX_TOKENS_PER_FILE) {
        throw new Error(
            `${file.name}: Converted document exceeds ${MAX_TOKENS_PER_FILE.toLocaleString()} token limit`
        )
    }

    return {
        file: new File([content], `${file.name}.md`, {
            type: "text/markdown",
            lastModified: file.lastModified
        }),
        content,
        estimatedTokens,
        sourceFormat: metadata.format,
        sourceMediaType: metadata.mediaType
    }
}
