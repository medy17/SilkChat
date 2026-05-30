import { MAX_FILE_SIZE, getFileTypeInfo, isSupportedFile } from "@/lib/file_constants"

export type AttachmentCandidate = {
    name: string
    mimeType?: string
    size?: number
}

export type AttachmentModelSupport = {
    supportsVision: boolean
    supportsNativePdf: boolean
}

type StoredAttachmentLike = {
    fileName?: string
    fileType?: string
    filename?: string
    mediaType?: string
    url?: string
}

type MessageWithParts = {
    parts?: ReadonlyArray<{
        type: string
        filename?: string
        mediaType?: string
        url?: string
    }>
}

const getAttachmentName = (attachment: StoredAttachmentLike) => {
    if (attachment.fileName) return attachment.fileName
    if (attachment.filename) return attachment.filename
    if (!attachment.url) return "attachment"

    try {
        const parsed = new URL(attachment.url, "https://example.invalid")
        const key = parsed.searchParams.get("key")
        if (key) {
            const decodedKey = decodeURIComponent(key)
            return decodedKey.split("/").pop() ?? decodedKey
        }

        const decodedPath = decodeURIComponent(parsed.pathname)
        return decodedPath.split("/").pop() ?? decodedPath
    } catch {
        const sanitizedUrl = decodeURIComponent(attachment.url.split("?")[0] ?? attachment.url)
        return sanitizedUrl.split("/").pop() ?? sanitizedUrl
    }
}

const isPdfAttachment = (attachment: StoredAttachmentLike) =>
    getFileTypeInfo(getAttachmentName(attachment), attachment.fileType ?? attachment.mediaType)
        .isPdf === true

export const modelSupportsNativePdf = (model: { abilities: readonly string[] }) =>
    model.abilities.includes("native_pdf")

export const hasPdfAttachmentInUploadedFiles = (files: readonly StoredAttachmentLike[]) =>
    files.some(isPdfAttachment)

export const hasPdfAttachmentInMessages = (messages: readonly MessageWithParts[]) =>
    messages.some((message) =>
        message.parts?.some(
            (part) =>
                part.type === "file" &&
                isPdfAttachment({
                    filename: part.filename,
                    mediaType: part.mediaType,
                    url: part.url
                })
        )
    )

export const getAttachmentValidationError = (
    file: AttachmentCandidate,
    modelSupport: AttachmentModelSupport
) => {
    if (!isSupportedFile(file.name, file.mimeType)) {
        return `${file.name}: Unsupported file type`
    }

    const fileTypeInfo = getFileTypeInfo(file.name, file.mimeType)

    if (fileTypeInfo.isVisionImage && !modelSupport.supportsVision) {
        return `${file.name}: Current model doesn't support image files`
    }

    if (fileTypeInfo.isPdf && !modelSupport.supportsNativePdf) {
        return `${file.name}: Current model doesn't support PDF files`
    }

    if (!fileTypeInfo.isVisionImage && typeof file.size === "number" && file.size > MAX_FILE_SIZE) {
        return `${file.name}: File size exceeds 5MB limit`
    }

    return null
}
