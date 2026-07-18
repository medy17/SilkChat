export const CODE_EXECUTION_ARTIFACT_DIRECTORY_ENV = "SILKCHAT_ARTIFACT_DIR"
export const CODE_EXECUTION_ARTIFACT_STORAGE_ROOT = "code-artifacts"
export const MAX_CODE_EXECUTION_ARTIFACTS = 5
export const MAX_CODE_EXECUTION_ARTIFACT_BYTES = 15 * 1024 * 1024
export const MAX_CODE_EXECUTION_ARTIFACT_TOTAL_BYTES = 25 * 1024 * 1024
export const MAX_CODE_EXECUTION_ARTIFACT_SCAN_ENTRIES = 100
export const MAX_CODE_EXECUTION_ARTIFACT_DEPTH = 3

export type CodeExecutionArtifact = {
    key: string
    filename: string
    mediaType: string
    size: number
    url?: string
}

export type CodeExecutionArtifactError = {
    filename: string
    error: string
}

const TEXT_MEDIA_TYPES = new Map<string, string>([
    [".csv", "text/csv"],
    [".tsv", "text/tab-separated-values"],
    [".md", "text/markdown"],
    [".markdown", "text/markdown"],
    [".json", "application/json"],
    [".jsonl", "application/x-ndjson"],
    [".ndjson", "application/x-ndjson"],
    [".xml", "application/xml"],
    [".yaml", "application/yaml"],
    [".yml", "application/yaml"],
    [".txt", "text/plain"],
    [".log", "text/plain"],
    [".sql", "text/plain"],
    [".py", "text/plain"],
    [".r", "text/plain"],
    [".js", "text/plain"],
    [".mjs", "text/plain"],
    [".cjs", "text/plain"],
    [".ts", "text/plain"],
    [".tsx", "text/plain"],
    [".jsx", "text/plain"],
    [".css", "text/plain"],
    [".tex", "text/plain"]
])

const ZIP_MEDIA_TYPES = new Map<string, string>([
    [".zip", "application/zip"],
    [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
])

const getExtension = (filename: string) => filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ""

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]) =>
    signature.every((value, index) => bytes[index] === value)

const hasZipSignature = (bytes: Uint8Array) =>
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])

const isUtf8Text = (bytes: Uint8Array) => {
    if (bytes.includes(0)) return false
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        return true
    } catch {
        return false
    }
}

export const detectCodeExecutionArtifactMediaType = (
    filename: string,
    bytes: Uint8Array
): string | null => {
    const extension = getExtension(filename)

    if (TEXT_MEDIA_TYPES.has(extension)) {
        return isUtf8Text(bytes) ? (TEXT_MEDIA_TYPES.get(extension) ?? null) : null
    }

    if (extension === ".pdf") {
        return startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) ? "application/pdf" : null
    }
    if (extension === ".png") {
        return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            ? "image/png"
            : null
    }
    if (extension === ".jpg" || extension === ".jpeg") {
        return startsWithBytes(bytes, [0xff, 0xd8, 0xff]) ? "image/jpeg" : null
    }
    if (extension === ".webp") {
        return bytes.length >= 12 &&
            startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
            ? "image/webp"
            : null
    }
    if (ZIP_MEDIA_TYPES.has(extension)) {
        return hasZipSignature(bytes) ? (ZIP_MEDIA_TYPES.get(extension) ?? null) : null
    }
    if (extension === ".sqlite" || extension === ".sqlite3" || extension === ".db") {
        return new TextDecoder().decode(bytes.slice(0, 16)) === "SQLite format 3\0"
            ? "application/vnd.sqlite3"
            : null
    }
    if (extension === ".parquet") {
        return bytes.length >= 8 &&
            new TextDecoder().decode(bytes.slice(0, 4)) === "PAR1" &&
            new TextDecoder().decode(bytes.slice(-4)) === "PAR1"
            ? "application/vnd.apache.parquet"
            : null
    }

    return null
}

export const sanitizeCodeExecutionArtifactFilename = (value: string) => {
    const basename = value.split(/[\\/]/).at(-1)?.trim() ?? ""
    const withoutControls = [...basename]
        .filter((character) => {
            const codePoint = character.codePointAt(0) ?? 0
            return codePoint > 31 && codePoint !== 127
        })
        .join("")
        .trim()
    return withoutControls.slice(0, 120) || "artifact"
}

export const sanitizeCodeExecutionArtifactStorageSegment = (value: string) =>
    sanitizeCodeExecutionArtifactFilename(value)
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120) || "artifact"

const encodeKeyPath = (key: string) =>
    key
        .replace(/^\/+/, "")
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")

export const buildCodeExecutionArtifactPublicUrl = (key: string, publicAssetBaseUrl?: string) => {
    const baseUrl = publicAssetBaseUrl?.trim().replace(/\/+$/, "")
    if (!baseUrl) return undefined

    try {
        const parsed = new URL(baseUrl)
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined
        return `${baseUrl}/${encodeKeyPath(key)}`
    } catch {
        return undefined
    }
}

export const getCodeExecutionArtifactsFromToolOutput = (
    output: unknown,
    userId: string
): CodeExecutionArtifact[] => {
    if (!output || typeof output !== "object" || !("artifacts" in output)) return []
    if (!Array.isArray(output.artifacts)) return []

    const keyPrefix = `${CODE_EXECUTION_ARTIFACT_STORAGE_ROOT}/${userId}/`
    const seen = new Set<string>()
    const artifacts: CodeExecutionArtifact[] = []

    for (const value of output.artifacts) {
        if (!value || typeof value !== "object") continue
        const candidate = value as Partial<CodeExecutionArtifact>
        if (
            typeof candidate.key !== "string" ||
            !candidate.key.startsWith(keyPrefix) ||
            seen.has(candidate.key) ||
            typeof candidate.filename !== "string" ||
            candidate.filename.length === 0 ||
            candidate.filename.length > 120 ||
            typeof candidate.mediaType !== "string" ||
            candidate.mediaType.length === 0 ||
            typeof candidate.size !== "number" ||
            !Number.isSafeInteger(candidate.size) ||
            candidate.size < 0 ||
            candidate.size > MAX_CODE_EXECUTION_ARTIFACT_BYTES
        ) {
            continue
        }

        seen.add(candidate.key)
        artifacts.push({
            key: candidate.key,
            filename: candidate.filename,
            mediaType: candidate.mediaType,
            size: candidate.size,
            ...(typeof candidate.url === "string" && /^https?:\/\//.test(candidate.url)
                ? { url: candidate.url }
                : {})
        })
        if (artifacts.length === MAX_CODE_EXECUTION_ARTIFACTS) break
    }

    return artifacts
}
