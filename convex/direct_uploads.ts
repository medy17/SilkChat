import { httpAction } from "./_generated/server"
import { r2 } from "./attachments"
import { getAccountDeletionBlockerForAction } from "./lib/account_deletion_gate"
import {
    DEFAULT_UPLOAD_POLICY_VERSION,
    MAX_FILE_SIZE,
    UPLOAD_POLICY_HEADER,
    formatFileSizeLimit,
    getCorrectMimeType,
    getFileTypeInfo,
    isDocumentExtension,
    isSupportedFile
} from "./lib/file_constants"
import { getUserIdentity } from "./lib/identity"

const DIRECT_UPLOAD_TTL_SECONDS = 10 * 60
const MAX_IMPORT_SOURCE_SIZE = 100 * 1024 * 1024
const MAX_PERSONA_AVATAR_BYTES = 100 * 1024
const SUPPORTED_IMPORT_SOURCE_REGEX = /\.(md|markdown|txt|json)$/i
const SUPPORTED_IMPORT_MIME_TYPES = new Set([
    "text/markdown",
    "text/plain",
    "application/markdown",
    "application/json"
])
const AVATAR_EXTENSION_TO_MIME: Record<string, string> = {
    ".avif": "image/avif",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png"
}

export type DirectUploadPurpose =
    | "attachment"
    | "reference"
    | "persona-avatar"
    | "persona-doc"
    | "import-source"

type DirectUploadRequest = {
    purpose: DirectUploadPurpose
    fileName: string
    fileType?: string
    fileSize: number
}

const uploadPolicyHeaders = (headers?: HeadersInit) => ({
    ...headers,
    [UPLOAD_POLICY_HEADER]: DEFAULT_UPLOAD_POLICY_VERSION
})

const jsonResponse = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
        status,
        headers: uploadPolicyHeaders({ "Content-Type": "application/json" })
    })

const sanitizeKeySegment = (name: string) =>
    name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120) || "file"

const getAvatarMimeType = (fileName: string, mimeType: string) => {
    const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ""
    return (
        AVATAR_EXTENSION_TO_MIME[extension] ??
        (Object.values(AVATAR_EXTENSION_TO_MIME).includes(mimeType) ? mimeType : null)
    )
}

export const getDirectUploadPolicy = (request: DirectUploadRequest) => {
    const fileName = request.fileName.trim()
    const fileType = request.fileType?.trim() ?? ""
    const fileSize = request.fileSize

    if (!fileName) throw new Error("File name is required")
    if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
        throw new Error("Invalid file size")
    }

    switch (request.purpose) {
        case "attachment": {
            if (fileSize > MAX_FILE_SIZE) {
                throw new Error(`File size exceeds ${formatFileSizeLimit(MAX_FILE_SIZE)} limit`)
            }
            if (!isSupportedFile(fileName, fileType) || isDocumentExtension(fileName)) {
                throw new Error(`Unsupported file type: ${fileName}`)
            }
            return {
                prefix: "attachments",
                contentType: getCorrectMimeType(fileName, fileType)
            }
        }
        case "reference": {
            if (fileSize > MAX_FILE_SIZE) {
                throw new Error(`File size exceeds ${formatFileSizeLimit(MAX_FILE_SIZE)} limit`)
            }
            if (!getFileTypeInfo(fileName, fileType).isVisionImage) {
                throw new Error("Reference file must be an image")
            }
            return {
                prefix: "references",
                contentType: getCorrectMimeType(fileName, fileType)
            }
        }
        case "persona-avatar": {
            if (fileSize > MAX_PERSONA_AVATAR_BYTES) {
                throw new Error("Persona avatar must be 100KB or smaller")
            }
            const contentType = getAvatarMimeType(fileName, fileType)
            if (!contentType) throw new Error("Unsupported persona avatar format")
            return { prefix: "persona-avatars", contentType }
        }
        case "persona-doc": {
            if (!fileName.toLowerCase().endsWith(".md")) {
                throw new Error("Knowledge base documents must be markdown files")
            }
            if (fileSize > MAX_FILE_SIZE) {
                throw new Error(`Knowledge document exceeds ${formatFileSizeLimit(MAX_FILE_SIZE)}`)
            }
            return { prefix: "persona-docs", contentType: "text/markdown" }
        }
        case "import-source": {
            if (fileSize > MAX_IMPORT_SOURCE_SIZE) {
                throw new Error("Import source exceeds 100MB limit")
            }
            if (
                !SUPPORTED_IMPORT_SOURCE_REGEX.test(fileName) &&
                !SUPPORTED_IMPORT_MIME_TYPES.has(fileType.toLowerCase())
            ) {
                throw new Error(`Unsupported import file: ${fileName}`)
            }
            return {
                prefix: "imports",
                contentType: fileType || getCorrectMimeType(fileName, fileType)
            }
        }
    }
}

const buildStorageKey = (
    purpose: DirectUploadPurpose,
    prefix: string,
    userId: string,
    fileName: string
) => {
    const suffix = `${Date.now()}-${crypto.randomUUID()}-${sanitizeKeySegment(fileName)}`
    return purpose === "import-source"
        ? `${prefix}/${userId}/sources/${suffix}`
        : `${prefix}/${userId}/${suffix}`
}

const isOwnedUploadKey = (key: string, userId: string) =>
    ["attachments", "references", "persona-avatars", "persona-docs"].some((prefix) =>
        key.startsWith(`${prefix}/${userId}/`)
    ) || key.startsWith(`imports/${userId}/sources/`)

const parseJson = async (request: Request) => {
    try {
        return (await request.json()) as Record<string, unknown>
    } catch {
        throw new Error("Invalid JSON request")
    }
}

export const createDirectUpload = httpAction(async (ctx, request) => {
    try {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return jsonResponse({ error: "Unauthorized" }, 401)
        if (await getAccountDeletionBlockerForAction(ctx, user.id)) {
            return jsonResponse({ error: "Account deletion is in progress" }, 403)
        }

        const body = await parseJson(request)
        const purpose = body.purpose as DirectUploadPurpose
        if (
            !["attachment", "reference", "persona-avatar", "persona-doc", "import-source"].includes(
                purpose
            )
        ) {
            return jsonResponse({ error: "Invalid upload purpose" }, 400)
        }

        const uploadRequest = {
            purpose,
            fileName: typeof body.fileName === "string" ? body.fileName : "",
            fileType: typeof body.fileType === "string" ? body.fileType : "",
            fileSize: typeof body.fileSize === "number" ? body.fileSize : Number.NaN
        }
        const policy = getDirectUploadPolicy(uploadRequest)
        const key = buildStorageKey(purpose, policy.prefix, user.id, uploadRequest.fileName)
        const upload = await r2.createDirectUpload(ctx, {
            key,
            authorId: user.id,
            contentLength: uploadRequest.fileSize,
            contentType: policy.contentType,
            expiresIn: DIRECT_UPLOAD_TTL_SECONDS,
            ifNoneMatch: "*"
        })

        return jsonResponse(
            {
                key: upload.key,
                uploadUrl: upload.url,
                headers: upload.headers,
                expiresAt: upload.expiresAt,
                fileType: policy.contentType
            },
            200
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create upload"
        const status = /limit|invalid|unsupported|must be|required/i.test(message) ? 400 : 500
        return jsonResponse({ error: message }, status)
    }
})

export const completeDirectUpload = httpAction(async (ctx, request) => {
    try {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return jsonResponse({ error: "Unauthorized" }, 401)
        if (await getAccountDeletionBlockerForAction(ctx, user.id)) {
            return jsonResponse({ error: "Account deletion is in progress" }, 403)
        }

        const body = await parseJson(request)
        const key = typeof body.key === "string" ? body.key : ""
        if (!key || !isOwnedUploadKey(key, user.id)) {
            return jsonResponse({ error: "Upload does not belong to this user" }, 403)
        }

        await r2.syncMetadata(ctx, key, {
            authorId: user.id,
            requireReservation: true
        })
        const metadata = await r2.getMetadata(ctx, key)
        if (!metadata || metadata.authorId !== user.id || metadata.uploadStatus !== "ready") {
            return jsonResponse({ error: "Upload could not be finalized" }, 400)
        }

        return jsonResponse(
            {
                key,
                fileType: metadata.contentType ?? "application/octet-stream",
                fileSize: metadata.size ?? 0,
                uploadedAt: Date.now()
            },
            200
        )
    } catch (error) {
        return jsonResponse(
            {
                error: error instanceof Error ? error.message : "Failed to complete upload"
            },
            400
        )
    }
})
