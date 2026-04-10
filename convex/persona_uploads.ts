import { httpAction } from "./_generated/server"
import { r2 } from "./attachments"
import { estimateTokenCount } from "./lib/file_constants"
import { getUserIdentity } from "./lib/identity"

const sanitizeKeySegment = (name: string) =>
    name
        .normalize("NFD")
        .replace(
            /\u0300|\u0301|\u0302|\u0303|\u0304|\u0305|\u0306|\u0307|\u0308|\u0309|\u030A|\u030B|\u030C|\u030D|\u030E|\u030F|\u0310|\u0311|\u0312|\u0313|\u0314|\u0315|\u0316|\u0317|\u0318|\u0319|\u031A|\u031B|\u031C|\u031D|\u031E|\u031F|\u0320|\u0321|\u0322|\u0323|\u0324|\u0325|\u0326|\u0327|\u0328|\u0329|\u032A|\u032B|\u032C|\u032D|\u032E|\u032F|\u0330|\u0331|\u0332|\u0333|\u0334|\u0335|\u0336|\u0337|\u0338|\u0339|\u033A|\u033B|\u033C|\u033D|\u033E|\u033F|\u0340|\u0341|\u0342|\u0343|\u0344|\u0345|\u0346|\u0347|\u0348|\u0349|\u034A|\u034B|\u034C|\u034D|\u034E|\u034F|\u0350|\u0351|\u0352|\u0353|\u0354|\u0355|\u0356|\u0357|\u0358|\u0359|\u035A|\u035B|\u035C|\u035D|\u035E|\u035F|\u0360|\u0361|\u0362|\u0363|\u0364|\u0365|\u0366|\u0367|\u0368|\u0369|\u036A|\u036B|\u036C|\u036D|\u036E|\u036F/g,
            ""
        )
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120) || "file"

const ALLOWED_PERSONA_AVATAR_MIME_TYPES = new Set([
    "image/avif",
    "image/webp",
    "image/jpeg",
    "image/png"
])
const AVATAR_EXTENSION_TO_MIME: Record<string, string> = {
    ".avif": "image/avif",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png"
}
const MAX_PERSONA_AVATAR_BYTES = 100 * 1024
const MAX_PERSONA_DOC_TOKENS = 20_000

const jsonResponse = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    })

const getNormalizedAvatarMimeType = (fileName: string, mimeType: string) => {
    const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ""
    const mimeFromExtension = AVATAR_EXTENSION_TO_MIME[extension]

    if (mimeFromExtension) {
        return mimeFromExtension
    }

    if (ALLOWED_PERSONA_AVATAR_MIME_TYPES.has(mimeType)) {
        return mimeType === "image/jpg" ? "image/jpeg" : mimeType
    }

    return null
}

export const uploadPersonaAvatar = httpAction(async (ctx, request) => {
    try {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const formData = await request.formData()
        const file = formData.get("file") as Blob | null
        const fileName = String(formData.get("fileName") || "")

        if (!file || !fileName) {
            return jsonResponse({ error: "No avatar provided" }, 400)
        }

        const mimeType = getNormalizedAvatarMimeType(fileName, file.type)
        if (!mimeType) {
            return jsonResponse({ error: "Unsupported persona avatar format" }, 400)
        }

        if (file.size > MAX_PERSONA_AVATAR_BYTES) {
            return jsonResponse({ error: "Persona avatar must be 100KB or smaller" }, 400)
        }

        const key = `persona-avatars/${user.id}/${Date.now()}-${crypto.randomUUID()}-${sanitizeKeySegment(fileName)}`
        const fileBuffer = await file.arrayBuffer()
        const storedKey = await r2.store(ctx, new Uint8Array(fileBuffer), {
            authorId: user.id,
            key,
            type: mimeType
        })

        return jsonResponse(
            {
                success: true,
                key: storedKey,
                fileName,
                fileType: mimeType,
                fileSize: file.size,
                uploadedAt: Date.now()
            },
            200
        )
    } catch (error) {
        console.error("Error uploading persona avatar:", error)
        return jsonResponse(
            {
                error: `Failed to upload avatar: ${error instanceof Error ? error.message : "Unknown error"}`
            },
            500
        )
    }
})

export const uploadPersonaDoc = httpAction(async (ctx, request) => {
    try {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const formData = await request.formData()
        const file = formData.get("file") as Blob | null
        const fileName = String(formData.get("fileName") || "")

        if (!file || !fileName) {
            return jsonResponse({ error: "No knowledge document provided" }, 400)
        }

        if (!fileName.toLowerCase().endsWith(".md")) {
            return jsonResponse({ error: "Knowledge base documents must be markdown files" }, 400)
        }

        const fileBuffer = await file.arrayBuffer()
        const text = new TextDecoder().decode(fileBuffer)
        const tokenCount = estimateTokenCount(text)

        if (tokenCount > MAX_PERSONA_DOC_TOKENS) {
            return jsonResponse(
                {
                    error: `Knowledge document exceeds ${MAX_PERSONA_DOC_TOKENS.toLocaleString()} token limit`
                },
                400
            )
        }

        const key = `persona-docs/${user.id}/${Date.now()}-${crypto.randomUUID()}-${sanitizeKeySegment(fileName)}`
        const storedKey = await r2.store(ctx, new Uint8Array(fileBuffer), {
            authorId: user.id,
            key,
            type: "text/markdown"
        })

        return jsonResponse(
            {
                success: true,
                key: storedKey,
                fileName,
                fileType: "text/markdown",
                fileSize: file.size,
                tokenCount,
                uploadedAt: Date.now()
            },
            200
        )
    } catch (error) {
        console.error("Error uploading persona knowledge document:", error)
        return jsonResponse(
            {
                error: `Failed to upload knowledge document: ${error instanceof Error ? error.message : "Unknown error"}`
            },
            500
        )
    }
})
