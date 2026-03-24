import {
    MAX_FILE_SIZE,
    MAX_TOKENS_PER_FILE,
    estimateTokenCount,
    getFileTypeInfo,
    isImageMimeType,
    isSupportedFile
} from "@/lib/file_constants"

const IMAGE_COMPRESSION_CUTOFF_BYTES = 25 * 1024 * 1024
const IMAGE_COMPRESSION_STEPS = [
    { quality: 0.86, maxDimension: 4096 },
    { quality: 0.78, maxDimension: 3072 },
    { quality: 0.68, maxDimension: 2560 },
    { quality: 0.56, maxDimension: 2048 }
] as const

const SECTION_HEADER_REGEX = /^###\s+(User|Assistant(?:\s*\(([^)]+)\))?|System)\s*$/gm
const IMAGE_ATTACHMENT_REGEX = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g
const FILE_ATTACHMENT_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const DETAILS_BLOCK_REGEX = /<details[\s\S]*?<\/details>/gi

const MIME_EXTENSION_MAP: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/x-icon": ".ico",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/javascript": ".js",
    "application/javascript": ".js",
    "application/typescript": ".ts",
    "application/json": ".json",
    "text/html": ".html",
    "text/css": ".css"
}

export type ImportedMessageRole = "user" | "assistant" | "system"

export interface ParsedAttachmentReference {
    type: "file" | "image"
    url: string
    filename: string
}

export interface ParsedThreadImportMessage {
    role: ImportedMessageRole
    text: string
    attachments: ParsedAttachmentReference[]
    metadata?: {
        modelName?: string
    }
}

export interface ParsedThreadImportDocument {
    title: string
    messages: ParsedThreadImportMessage[]
    parseWarnings: string[]
}

const normalizeSpacing = (value: string) =>
    value
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

const normalizeTitle = (value: string) =>
    value
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100)

const toRole = (header: string): ImportedMessageRole => {
    if (header.toLowerCase() === "system") return "system"
    if (header.toLowerCase().startsWith("assistant")) return "assistant"
    return "user"
}

const getExtension = (name: string) => {
    const match = name.toLowerCase().match(/\.[^.]+$/)
    return match?.[0]
}

const sanitizeFilename = (value: string, fallback = "attachment") => {
    const decoded = (() => {
        try {
            return decodeURIComponent(value)
        } catch {
            return value
        }
    })()

    const cleaned = decoded
        .replace(/[?#].*$/, "")
        .replace(/[\\/:*?"<>|]/g, "-")
        .trim()

    return cleaned || fallback
}

const inferFilenameFromUrl = (url: string) => {
    try {
        const parsed = new URL(url)
        const fromPath = parsed.pathname.split("/").pop() || ""
        return sanitizeFilename(fromPath, "attachment")
    } catch {
        const fromPath = url.split("/").pop() || ""
        return sanitizeFilename(fromPath, "attachment")
    }
}

const stripAttachmentMarkup = (content: string) => {
    const attachments: ParsedAttachmentReference[] = []

    const withoutImages = content.replace(IMAGE_ATTACHMENT_REGEX, (_, alt: string, url: string) => {
        const filename = sanitizeFilename(alt || inferFilenameFromUrl(url), "image")
        attachments.push({
            type: "image",
            url,
            filename
        })
        return ""
    })

    const withoutFiles = withoutImages.replace(
        FILE_ATTACHMENT_REGEX,
        (_, label: string, url: string) => {
            const filename = sanitizeFilename(label || inferFilenameFromUrl(url), "attachment")
            attachments.push({
                type: "file",
                url,
                filename
            })
            return ""
        }
    )

    return {
        text: normalizeSpacing(withoutFiles),
        attachments
    }
}

const extractTitle = (markdown: string) => {
    const headingMatch = markdown.match(/^#\s+(.+)$/m)
    if (headingMatch?.[1]) {
        const heading = normalizeTitle(headingMatch[1])
        if (heading) return heading
    }

    const firstNonEmptyLine = markdown
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)

    return normalizeTitle(firstNonEmptyLine || "Imported Chat") || "Imported Chat"
}

export const parseThreadImportMarkdown = (markdown: string): ParsedThreadImportDocument => {
    const normalizedMarkdown = markdown.replace(/\r\n/g, "\n")
    const parseWarnings: string[] = []
    const title = extractTitle(normalizedMarkdown)

    const sectionMatches = Array.from(normalizedMarkdown.matchAll(SECTION_HEADER_REGEX))

    if (sectionMatches.length === 0) {
        const fallbackText = normalizeSpacing(normalizedMarkdown)
        if (!fallbackText) {
            return {
                title,
                messages: [],
                parseWarnings: ["No conversation content found"]
            }
        }

        parseWarnings.push("No role headings found. Imported as a single user message.")
        return {
            title,
            messages: [
                {
                    role: "user",
                    text: fallbackText,
                    attachments: []
                }
            ],
            parseWarnings
        }
    }

    const messages: ParsedThreadImportMessage[] = []

    for (let index = 0; index < sectionMatches.length; index += 1) {
        const match = sectionMatches[index]
        const nextMatch = sectionMatches[index + 1]
        const roleHeader = match[1]
        const modelName = match[2]?.trim()
        const start = (match.index || 0) + match[0].length
        const end = nextMatch?.index ?? normalizedMarkdown.length

        const sectionContent = normalizedMarkdown
            .slice(start, end)
            .replace(/^---\s*$/gm, "")
            .replace(DETAILS_BLOCK_REGEX, "")
            .trim()

        const extracted = stripAttachmentMarkup(sectionContent)

        if (!extracted.text && extracted.attachments.length === 0) {
            continue
        }

        messages.push({
            role: toRole(roleHeader),
            text: extracted.text,
            attachments: extracted.attachments,
            metadata: modelName ? { modelName } : undefined
        })
    }

    return {
        title,
        messages,
        parseWarnings
    }
}

const extensionFromMimeType = (mimeType?: string) => {
    if (!mimeType) return undefined
    return MIME_EXTENSION_MAP[mimeType.toLowerCase()]
}

const ensureAttachmentFilename = ({
    fileNameHint,
    url,
    mimeType
}: {
    fileNameHint: string
    url: string
    mimeType?: string
}) => {
    const hint = sanitizeFilename(fileNameHint, "attachment")
    if (getExtension(hint)) {
        return hint
    }

    const fromUrl = inferFilenameFromUrl(url)
    if (getExtension(fromUrl)) {
        return sanitizeFilename(fromUrl, hint)
    }

    const extension = extensionFromMimeType(mimeType)
    if (extension) {
        return `${hint}${extension}`
    }

    return `${hint}.bin`
}

export const fetchRemoteAttachmentAsFile = async ({
    url,
    filename
}: {
    url: string
    filename: string
}) => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to download attachment (${response.status})`)
    }

    const blob = await response.blob()
    const resolvedName = ensureAttachmentFilename({
        fileNameHint: filename,
        url,
        mimeType: blob.type
    })

    return new File([blob], resolvedName, {
        type: blob.type || undefined
    })
}

const compressImageToLimit = async (file: File) => {
    const objectUrl = URL.createObjectURL(file)

    try {
        const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error("Failed to decode image"))
            image.src = objectUrl
        })

        for (const step of IMAGE_COMPRESSION_STEPS) {
            const largestSide = Math.max(sourceImage.width, sourceImage.height)
            const scale = Math.min(1, step.maxDimension / largestSide)
            const targetWidth = Math.max(1, Math.floor(sourceImage.width * scale))
            const targetHeight = Math.max(1, Math.floor(sourceImage.height * scale))

            const canvas = document.createElement("canvas")
            canvas.width = targetWidth
            canvas.height = targetHeight

            const context = canvas.getContext("2d")
            if (!context) {
                throw new Error("Image compression unavailable in this browser")
            }

            context.clearRect(0, 0, targetWidth, targetHeight)
            context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight)

            const compressedBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), "image/webp", step.quality)
            })

            if (!compressedBlob) {
                continue
            }

            const compressedNameBase = file.name.replace(/\.[^.]+$/, "") || "attachment"
            const compressedFile = new File([compressedBlob], `${compressedNameBase}.webp`, {
                type: "image/webp",
                lastModified: Date.now()
            })

            if (compressedFile.size <= MAX_FILE_SIZE) {
                return compressedFile
            }
        }

        throw new Error("Could not compress image below 5MB")
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export const prepareImportedAttachmentFile = async (inputFile: File) => {
    if (!isSupportedFile(inputFile.name, inputFile.type)) {
        throw new Error(`Unsupported file type: ${inputFile.name}`)
    }

    const fileTypeInfo = getFileTypeInfo(inputFile.name, inputFile.type)
    let file = inputFile

    if (fileTypeInfo.isVisionImage && file.size > MAX_FILE_SIZE) {
        if (file.size > IMAGE_COMPRESSION_CUTOFF_BYTES) {
            throw new Error(`${file.name}: Image exceeds 25MB limit`)
        }

        if (!isImageMimeType(file.type)) {
            throw new Error(`${file.name}: Unsupported image type`)
        }

        file = await compressImageToLimit(file)
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`${file.name}: File size exceeds 5MB limit`)
    }

    if (fileTypeInfo.isText && (!fileTypeInfo.isImage || fileTypeInfo.isSvg)) {
        const textContent = await file.text()
        const tokenCount = estimateTokenCount(textContent)

        if (tokenCount > MAX_TOKENS_PER_FILE) {
            throw new Error(
                `${file.name}: File exceeds ${MAX_TOKENS_PER_FILE.toLocaleString()} token limit`
            )
        }
    }

    return file
}
