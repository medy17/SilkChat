import type { UploadedFile } from "@/lib/chat-store"
import {
    convertDocumentToMarkdownFile,
    createInlineDocumentDataUrl
} from "@/lib/document-conversion"
import { isDocumentExtension } from "@/lib/file_constants"
import { type PastedTextDecision, classifyPastedText } from "@/lib/pasted-text"

export type AttachmentIngestResult = {
    file: File
    originalFile: File
    delivery: "inline" | "upload"
    tileKind: "attachment" | "large-paste"
    source: "upload" | "document"
    displayName: string
    content?: string
    decision?: PastedTextDecision
}

export const ingestChatAttachment = async (
    file: File,
    { canReferenceLongTextAttachments }: { canReferenceLongTextAttachments: boolean }
): Promise<AttachmentIngestResult> => {
    if (!isDocumentExtension(file.name)) {
        return {
            file,
            originalFile: file,
            delivery: "upload",
            tileKind: "attachment",
            source: "upload",
            displayName: file.name
        }
    }

    const converted = await convertDocumentToMarkdownFile(file)
    const decision = classifyPastedText(converted.content, {
        canReferenceLongTextAttachments
    })

    return {
        file: converted.file,
        originalFile: file,
        delivery: decision.disposition === "inline" ? "inline" : "upload",
        tileKind: "large-paste",
        source: "document",
        displayName: file.name,
        content: converted.content,
        decision
    }
}

export const createInlineIngestedFile = (ingested: AttachmentIngestResult): UploadedFile => {
    if (ingested.delivery !== "inline" || !ingested.content) {
        throw new Error("Attachment is not inline content")
    }

    return {
        key: `inline-document:${crypto.randomUUID()}`,
        fileName: ingested.displayName,
        fileType: "text/markdown",
        fileSize: ingested.originalFile.size,
        uploadedAt: Date.now(),
        source: "document",
        tileKind: "large-paste",
        displayName: ingested.displayName,
        inlineDataUrl: createInlineDocumentDataUrl(ingested.content)
    }
}

export const finalizeIngestedUpload = (
    uploaded: UploadedFile,
    ingested: AttachmentIngestResult
): UploadedFile =>
    ingested.tileKind === "large-paste"
        ? {
              ...uploaded,
              fileName: ingested.displayName,
              fileType: "text/markdown",
              source: "document",
              tileKind: "large-paste",
              displayName: ingested.displayName,
              largePasteContent: ingested.content
          }
        : { ...uploaded, tileKind: "attachment" }
