import type { FileUIPart } from "ai"
import type { UploadedFile } from "./chat-store"
import { getAttachmentTileMediaType } from "./attachment-tile"
import { getPublicR2AssetUrl } from "./r2-public-url"
import { getAttachmentValidationError, type AttachmentModelSupport } from "./attachment-support"
import type { UploadPolicy } from "./file_constants"

export const ATTACHMENT_ONLY_TEXT = "The user opted not to include text."
export const resolveComposerText = (text: string, attachmentCount: number): string | null =>
    text.trim() || (attachmentCount > 0 ? ATTACHMENT_ONLY_TEXT : null)

export const attachmentToMessagePart = (file: UploadedFile): FileUIPart => ({
    type: "file",
    url: file.inlineDataUrl ?? getPublicR2AssetUrl(file.key),
    mediaType: getAttachmentTileMediaType(file.fileType, file.tileKind),
    filename: file.fileName
})

export function prepareComposerMessage({
    text,
    attachments = [],
    existingParts = [],
    deletedUrls = [],
    support,
    policy
}: {
    text: string
    attachments?: readonly UploadedFile[]
    existingParts?: readonly FileUIPart[]
    deletedUrls?: readonly string[]
    support: AttachmentModelSupport
    policy: UploadPolicy
}) {
    const remainingParts = existingParts.filter((part) => !deletedUrls.includes(part.url))
    const fileParts = [...remainingParts, ...attachments.map(attachmentToMessagePart)]
    const candidates = [
        ...remainingParts.map((part) => ({
            name: part.filename ?? "attachment",
            mimeType: part.mediaType
        })),
        ...attachments.map((file) => ({
            name: file.fileName,
            mimeType: file.fileType,
            size: file.fileSize
        }))
    ]
    return {
        text: resolveComposerText(text, fileParts.length),
        fileParts,
        errors: candidates
            .map((file) => getAttachmentValidationError(file, support, policy))
            .filter((error): error is string => Boolean(error))
    }
}

export async function readPastedAttachment(file: UploadedFile): Promise<string> {
    if (file.largePasteContent !== undefined) return file.largePasteContent
    const response = await fetch(file.inlineDataUrl ?? getPublicR2AssetUrl(file.key))
    if (!response.ok) throw new Error("Could not load pasted text. Try again.")
    return response.text()
}
