// Supported raster image file extensions
export const SUPPORTED_RASTER_IMAGE_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".avif",
    ".bmp",
    ".ico"
] as const

// Supported vector image file extensions
export const SUPPORTED_VECTOR_IMAGE_EXTENSIONS = [".svg"] as const

// Supported image file extensions
export const SUPPORTED_IMAGE_EXTENSIONS = [
    ...SUPPORTED_RASTER_IMAGE_EXTENSIONS,
    ...SUPPORTED_VECTOR_IMAGE_EXTENSIONS
] as const

// Supported code file extensions
export const SUPPORTED_CODE_EXTENSIONS = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".sql",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".swift",
    ".kt",
    ".dart",
    ".vue",
    ".svelte",
    ".css",
    ".scss",
    ".html",
    ".xml",
    ".json",
    ".yaml",
    ".yml"
] as const

// Supported plain text file extensions
export const SUPPORTED_PLAIN_TEXT_EXTENSIONS = [".md", ".mdx", ".txt", ".csv", ".tsv"] as const

// Combined text extensions (code + plain text)
export const SUPPORTED_TEXT_EXTENSIONS = [
    ...SUPPORTED_PLAIN_TEXT_EXTENSIONS,
    ...SUPPORTED_CODE_EXTENSIONS
] as const

// Supported raster MIME types for images
export const SUPPORTED_RASTER_IMAGE_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
    "image/x-icon"
] as const

// Supported vector MIME types for images
export const SUPPORTED_VECTOR_IMAGE_MIME_TYPES = ["image/svg+xml"] as const

// Supported MIME types for images
export const SUPPORTED_IMAGE_MIME_TYPES = [
    ...SUPPORTED_RASTER_IMAGE_MIME_TYPES,
    ...SUPPORTED_VECTOR_IMAGE_MIME_TYPES
] as const

// Supported MIME types for text files
export const SUPPORTED_TEXT_MIME_TYPES = [
    "text/plain",
    "text/markdown",
    "text/html",
    "text/css",
    "text/javascript",
    "text/xml",
    "text/yaml",
    "text/csv",
    "text/tab-separated-values",
    "application/json",
    "application/javascript",
    "application/typescript"
] as const

// All supported extensions combined
export const ALL_SUPPORTED_EXTENSIONS = [
    ...SUPPORTED_IMAGE_EXTENSIONS,
    ...SUPPORTED_TEXT_EXTENSIONS,
    ".pdf"
] as const

// File size limits
export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024 // 5MB stored-image target
export const MAX_CHAT_IMAGE_DIMENSION = 2048
export const LONG_ATTACHMENT_REFERENCE_TOKEN_THRESHOLD = 16_000
export const MAX_INLINE_TEXT_ATTACHMENT_TOKENS_WITHOUT_EXECUTION = 32_000
// Long text attachments above 16k estimated tokens are routed to code execution by URL,
// so this is an upload abuse guard rather than a model-context limit. The 15 MB byte
// limit remains the effective ceiling for ordinary text files.
export const MAX_TOKENS_PER_FILE = 8_000_000
export const MAX_ATTACHMENTS_PER_THREAD = 100
export const formatFileSizeLimit = (bytes: number) => `${bytes / 1024 / 1024}MB`

// Used by non-composer ingestion paths that perform their own guarded image processing.
export const MAX_COMPRESSIBLE_IMAGE_SIZE = 25 * 1024 * 1024 // 25MB
export const IMAGE_COMPRESSION_STEPS = [
    { quality: 0.86, maxDimension: 4096 },
    { quality: 0.78, maxDimension: 3072 },
    { quality: 0.68, maxDimension: 2560 },
    { quality: 0.56, maxDimension: 2048 }
] as const

export const UPLOAD_POLICY_HEADER = "X-Upload-Policy-Version"

export type UploadPolicy = {
    maxFileSize: number
    maxImageFileSize: number
    maxImageDimension: number
    maxTokensPerFile: number
    maxAttachmentsPerThread: number
    supportedRasterImageExtensions: readonly string[]
    supportedVectorImageExtensions: readonly string[]
    supportedCodeExtensions: readonly string[]
    supportedPlainTextExtensions: readonly string[]
    supportedRasterImageMimeTypes: readonly string[]
    supportedVectorImageMimeTypes: readonly string[]
    supportedTextMimeTypes: readonly string[]
    imageCompressionSteps: readonly {
        quality: number
        maxDimension: number
    }[]
}

export const DEFAULT_UPLOAD_POLICY = {
    maxFileSize: MAX_FILE_SIZE,
    maxImageFileSize: MAX_IMAGE_FILE_SIZE,
    maxImageDimension: MAX_CHAT_IMAGE_DIMENSION,
    maxTokensPerFile: MAX_TOKENS_PER_FILE,
    maxAttachmentsPerThread: MAX_ATTACHMENTS_PER_THREAD,
    supportedRasterImageExtensions: SUPPORTED_RASTER_IMAGE_EXTENSIONS,
    supportedVectorImageExtensions: SUPPORTED_VECTOR_IMAGE_EXTENSIONS,
    supportedCodeExtensions: SUPPORTED_CODE_EXTENSIONS,
    supportedPlainTextExtensions: SUPPORTED_PLAIN_TEXT_EXTENSIONS,
    supportedRasterImageMimeTypes: SUPPORTED_RASTER_IMAGE_MIME_TYPES,
    supportedVectorImageMimeTypes: SUPPORTED_VECTOR_IMAGE_MIME_TYPES,
    supportedTextMimeTypes: SUPPORTED_TEXT_MIME_TYPES,
    imageCompressionSteps: IMAGE_COMPRESSION_STEPS
} as const satisfies UploadPolicy

const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`
    }

    if (value && typeof value === "object") {
        return `{${Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
            .join(",")}}`
    }

    return JSON.stringify(value)
}

export const getUploadPolicyVersion = (policy: UploadPolicy = DEFAULT_UPLOAD_POLICY) => {
    const input = stableStringify(policy)
    let hash = 0x811c9dc5

    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
    }

    return (hash >>> 0).toString(16).padStart(8, "0")
}

export const DEFAULT_UPLOAD_POLICY_VERSION = getUploadPolicyVersion(DEFAULT_UPLOAD_POLICY)

// PDF-specific limits
export const MAX_PDF_PAGES = 100
export const MAX_PDF_TOKENS = 32000 // 32k tokens

// File type validation functions
export const isImageExtension = (filename: string) => {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
    return ext ? (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) : false
}

export const isSvgExtension = (filename: string) => {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
    return ext ? (SUPPORTED_VECTOR_IMAGE_EXTENSIONS as readonly string[]).includes(ext) : false
}

export const isTextExtension = (filename: string) => {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
    return ext ? (SUPPORTED_TEXT_EXTENSIONS as readonly string[]).includes(ext) : false
}

export const isImageMimeType = (mimeType: string) => {
    return (
        mimeType.startsWith("image/") ||
        (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
    )
}

export const isSvgMimeType = (mimeType: string) =>
    (SUPPORTED_VECTOR_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)

export const isVisionCompatibleImageMimeType = (mimeType: string) =>
    (SUPPORTED_RASTER_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)

export const isTextMimeType = (mimeType: string) => {
    return (
        mimeType.startsWith("text/") ||
        (SUPPORTED_TEXT_MIME_TYPES as readonly string[]).includes(mimeType)
    )
}

export const isSupportedFile = (filename: string, mimeType?: string) => {
    // For text files, prioritize extension over MIME type since browsers often return
    // application/octet-stream for code files like .c, .rs, etc.
    const isText = isTextExtension(filename)
    const isImage = isImageExtension(filename) || (mimeType ? isImageMimeType(mimeType) : false)
    const isPdf =
        filename.toLowerCase().endsWith(".pdf") ||
        mimeType === "application/pdf" ||
        mimeType === "application/x-pdf"
    return isImage || isText || isPdf
}

// Get file accept attribute for input element
export const getFileAcceptAttribute = (includeImages = true) => {
    const textExtensions = SUPPORTED_TEXT_EXTENSIONS.join(",")
    if (includeImages) {
        return `image/*,.pdf,${textExtensions}`
    }
    return `${textExtensions},.svg`
}

export const estimateTokenCount = (text: string): number => {
    let ascii = 0
    let cjk = 0
    let nonLatin = 0
    let emojiOrSymbol = 0
    let punctuation = 0
    let whitespace = 0

    for (const char of text) {
        if (/\s/u.test(char)) {
            whitespace++
        } else if (
            /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(char)
        ) {
            cjk++
        } else if (/[A-Za-z0-9]/u.test(char)) {
            ascii++
        } else if (/\p{L}|\p{N}/u.test(char)) {
            nonLatin++
        } else if (/\p{S}/u.test(char)) {
            emojiOrSymbol++
        } else {
            punctuation++
        }
    }

    const raw =
        ascii / 4 +
        whitespace / 20 +
        cjk * 1.1 +
        nonLatin / 2.2 +
        emojiOrSymbol * 2 +
        punctuation / 2

    const punctuationDensity = punctuation / Math.max(text.length, 1)
    const densityMultiplier = punctuationDensity > 0.25 ? 1.15 : 1

    const codeish =
        /```|~~~|[{[\]}();<>]|=>|->|::|\/\*|\*\/|\/\/|import\s|export\s|function\s|const\s|let\s|var\s|class\s|interface\s|type\s|enum\s|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|CREATE\s|FROM\s|WHERE\s|package\s|namespace\s/i.test(
            text
        )

    const codeMultiplier = codeish ? 1.25 : 1

    return Math.ceil(raw * densityMultiplier * codeMultiplier * 1.15)
}

// File type detection result
export interface FileTypeInfo {
    isImage: boolean
    isVisionImage: boolean
    isSvg: boolean
    isCode: boolean
    isText: boolean
    extension?: string
    isPdf?: boolean
}

export const getFileTypeInfo = (filename: string, mimeType?: string) => {
    const fileName = filename.toLowerCase()
    const extension = fileName.match(/\.[^.]+$/)?.[0]

    // Check by extension first (more reliable than MIME type)
    const isImage = isImageExtension(fileName)
    const isSvg = isSvgExtension(fileName) || (mimeType ? isSvgMimeType(mimeType) : false)
    const isCode = extension
        ? (SUPPORTED_CODE_EXTENSIONS as readonly string[]).includes(extension)
        : false
    const isPlainText = extension
        ? (SUPPORTED_PLAIN_TEXT_EXTENSIONS as readonly string[]).includes(extension)
        : false

    // For text files, extension is more reliable than MIME type
    // (browsers often return application/octet-stream for code files)
    const isText = isCode || isPlainText || isTextExtension(fileName) || isSvg

    // If not detected by extension, fall back to MIME type for images
    const finalIsImage = isImage || (mimeType ? isImageMimeType(mimeType) : false)
    const isVisionImage =
        !isSvg &&
        (isImage ||
            (mimeType ? isVisionCompatibleImageMimeType(mimeType) : false) ||
            (extension
                ? (SUPPORTED_RASTER_IMAGE_EXTENSIONS as readonly string[]).includes(extension)
                : false))
    const isPdf =
        extension === ".pdf" || mimeType === "application/pdf" || mimeType === "application/x-pdf"

    return {
        isImage: finalIsImage,
        isVisionImage,
        isSvg,
        isCode,
        isText,
        extension,
        isPdf
    } satisfies FileTypeInfo
}

// Get correct MIME type for a file based on its extension
export const getCorrectMimeType = (filename: string, browserMimeType?: string): string => {
    const fileInfo = getFileTypeInfo(filename, browserMimeType)

    // If it's an image and browser provided a valid image MIME type, use it
    if (fileInfo.isImage && browserMimeType && isImageMimeType(browserMimeType)) {
        return browserMimeType
    }

    // If it's a text file (any kind), just use text/plain
    if (fileInfo.isText) {
        return "text/plain"
    }

    // Default fallback
    return browserMimeType || "application/octet-stream"
}
