import { internal } from "./_generated/api"
import { type ActionCtx, httpAction } from "./_generated/server"
import { decryptKey } from "./lib/encryption"
import { getGoogleAccessToken } from "./lib/google_auth"
import {
    getGoogleAuthMode,
    getGoogleVertexConfig,
    hasInternalGoogleVertexConfig
} from "./lib/google_provider"
import { getUserIdentity } from "./lib/identity"

const DEFAULT_SPEECH_LOCATION = "us"
const DEFAULT_LANGUAGE_CODES = ["auto"]
const DEFAULT_STT_PROVIDER = "google"
const CHIRP_MODEL = "chirp_3"
const GROQ_MODEL = "whisper-large-v3-turbo"

type SttProvider = "google" | "groq"

type GoogleSpeechConfig = {
    project: string
    location: string
    credentials: {
        client_email: string
        private_key: string
    }
}

const getSttProvider = (): SttProvider => {
    const provider = (process.env.STT_PROVIDER || DEFAULT_STT_PROVIDER).trim().toLowerCase()
    return provider === "groq" ? "groq" : "google"
}

const normalizeSpeechLocation = (location?: string) => {
    if (!location || location === "us-central1") {
        return process.env.GOOGLE_SPEECH_LOCATION || DEFAULT_SPEECH_LOCATION
    }

    return location
}

const getSpeechApiBaseUrl = (location: string) => {
    if (location === "global") {
        return "https://speech.googleapis.com"
    }

    return `https://${location}-speech.googleapis.com`
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

const getFilenameFromMimeType = (mimeType: string): string => {
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
        return "audio.mp4"
    }
    if (mimeType.includes("webm")) {
        return "audio.webm"
    }
    if (mimeType.includes("ogg")) {
        return "audio.ogg"
    }
    if (mimeType.includes("wav")) {
        return "audio.wav"
    }
    if (mimeType.includes("aac")) {
        return "audio.aac"
    }
    return "audio.webm"
}

async function getUserSettings(ctx: Pick<ActionCtx, "runQuery">, userId: string) {
    return await ctx.runQuery(internal.settings.getUserSettingsInternal, { userId })
}

async function getGoogleSpeechConfig(
    ctx: Pick<ActionCtx, "runQuery">,
    userId: string
): Promise<GoogleSpeechConfig> {
    const settings = await getUserSettings(ctx, userId)
    const googleProvider = settings.coreAIProviders?.google

    if (googleProvider?.enabled && googleProvider.encryptedKey) {
        try {
            const decryptedKey = await decryptKey(googleProvider.encryptedKey)
            if (decryptedKey) {
                const authMode = getGoogleAuthMode(decryptedKey, googleProvider.authMode)
                if (authMode === "vertex") {
                    const vertexConfig = getGoogleVertexConfig(decryptedKey)
                    console.log("Using user's Google Vertex credentials for speech-to-text")
                    return {
                        project: vertexConfig.project,
                        location: normalizeSpeechLocation(vertexConfig.location),
                        credentials: vertexConfig.credentials
                    }
                }

                console.warn(
                    "Google provider is configured for AI Studio. Speech-to-text requires Vertex credentials."
                )
            }
        } catch (error) {
            console.warn(
                "Failed to get user's Google Vertex credentials, falling back to internal configuration:",
                error
            )
        }
    }

    if (!hasInternalGoogleVertexConfig()) {
        throw new Error(
            "Voice input service not configured. Configure Google in Vertex AI mode in AI Options or set internal GOOGLE_VERTEX_* credentials."
        )
    }

    const vertexConfig = getGoogleVertexConfig("internal")
    console.log("Using internal Google Vertex credentials for speech-to-text")
    return {
        project: vertexConfig.project,
        location: normalizeSpeechLocation(vertexConfig.location),
        credentials: vertexConfig.credentials
    }
}

async function getGroqApiKey(ctx: Pick<ActionCtx, "runQuery">, userId: string): Promise<string> {
    const settings = await getUserSettings(ctx, userId)
    const groqProvider = settings.coreAIProviders?.groq

    if (groqProvider?.enabled && groqProvider.encryptedKey) {
        try {
            const decryptedKey = await decryptKey(groqProvider.encryptedKey)
            if (decryptedKey) {
                console.log("Using user's Groq credentials for speech-to-text")
                return decryptedKey
            }
        } catch (error) {
            console.warn(
                "Failed to get user's Groq credentials, falling back to internal configuration:",
                error
            )
        }
    }

    const internalKey = process.env.GROQ_API_KEY
    if (internalKey && internalKey !== "your-groq-api-key-here") {
        console.log("Using internal Groq credentials for speech-to-text")
        return internalKey
    }

    throw new Error(
        "Voice input service not configured. Set GROQ_API_KEY in Convex or configure Groq in AI Options."
    )
}

async function validateSpeechConfiguration(
    ctx: Pick<ActionCtx, "runQuery">,
    userId: string,
    provider: SttProvider
) {
    if (provider === "groq") {
        await getGroqApiKey(ctx, userId)
        return
    }

    await getGoogleSpeechConfig(ctx, userId)
}

async function transcribeWithGoogle(
    ctx: Pick<ActionCtx, "runQuery">,
    userId: string,
    audioFile: Blob
) {
    const speechConfig = await getGoogleSpeechConfig(ctx, userId)
    const accessToken = await getGoogleAccessToken(
        speechConfig.credentials.client_email,
        speechConfig.credentials.private_key
    )
    const audioBase64 = arrayBufferToBase64(await audioFile.arrayBuffer())
    const recognizer = `projects/${speechConfig.project}/locations/${speechConfig.location}/recognizers/_`
    const baseUrl = getSpeechApiBaseUrl(speechConfig.location)

    return await fetch(`${baseUrl}/v2/${recognizer}:recognize`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            config: {
                autoDecodingConfig: {},
                languageCodes: DEFAULT_LANGUAGE_CODES,
                model: CHIRP_MODEL
            },
            content: audioBase64
        })
    })
}

async function transcribeWithGroq(
    ctx: Pick<ActionCtx, "runQuery">,
    userId: string,
    audioFile: Blob
) {
    const apiKey = await getGroqApiKey(ctx, userId)
    const formData = new FormData()
    formData.append("file", audioFile, getFilenameFromMimeType(audioFile.type))
    formData.append("model", GROQ_MODEL)
    formData.append("response_format", "json")
    formData.append("temperature", "0")

    return await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`
        },
        body: formData
    })
}

const getInvalidCredentialError = (provider: SttProvider) =>
    provider === "groq"
        ? "Invalid Groq credentials. Please check your Groq configuration."
        : "Invalid Google credentials. Please check your Vertex configuration."

const getForbiddenError = (provider: SttProvider) =>
    provider === "groq"
        ? "Groq speech-to-text access was denied. Check your Groq account and key permissions."
        : "Google Speech-to-Text access was denied. Ensure the service account can use Speech-to-Text V2."

export const transcribeAudio = httpAction(async (ctx, request) => {
    try {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            console.error("Unauthorized")
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            })
        }

        const provider = getSttProvider()
        console.log(`Using speech-to-text provider: ${provider}`)

        try {
            await validateSpeechConfiguration(ctx, user.id, provider)
        } catch (error) {
            return new Response(
                JSON.stringify({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Voice input service not configured."
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                }
            )
        }

        const formData = await request.formData()
        const audioFile = formData.get("audio") as Blob

        if (!audioFile) {
            console.error("No audio file provided")
            return new Response(JSON.stringify({ error: "No audio file provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            })
        }

        const maxSize = 25 * 1024 * 1024
        if (audioFile.size > maxSize) {
            console.error("Audio file too large (max 25MB)")
            return new Response(JSON.stringify({ error: "Audio file too large (max 25MB)" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            })
        }

        const filename = getFilenameFromMimeType(audioFile.type)
        console.log(
            `Transcribing audio: ${audioFile.size} bytes, type: ${audioFile.type}, filename: ${filename}`
        )

        const response =
            provider === "groq"
                ? await transcribeWithGroq(ctx, user.id, audioFile)
                : await transcribeWithGoogle(ctx, user.id, audioFile)

        if (!response.ok) {
            const errorText = await response.text()
            console.error(
                `${provider === "groq" ? "Groq" : "Google Speech"} API error:`,
                response.status,
                errorText
            )

            if (response.status === 401) {
                return new Response(
                    JSON.stringify({ error: getInvalidCredentialError(provider) }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" }
                    }
                )
            }

            if (response.status === 403) {
                return new Response(JSON.stringify({ error: getForbiddenError(provider) }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                })
            }

            if (response.status === 429) {
                return new Response(
                    JSON.stringify({
                        error: "Rate limit exceeded. Please try again later."
                    }),
                    {
                        status: 429,
                        headers: { "Content-Type": "application/json" }
                    }
                )
            }

            console.error("Transcription service temporarily unavailable")
            return new Response(
                JSON.stringify({
                    error: "Transcription service temporarily unavailable"
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                }
            )
        }

        const transcriptionResult = (await response.json()) as {
            text?: string
            results?: Array<{
                alternatives?: Array<{
                    transcript?: string
                }>
                languageCode?: string
            }>
        }

        const text =
            provider === "groq"
                ? transcriptionResult.text?.trim()
                : transcriptionResult.results
                      ?.map((result) => result.alternatives?.[0]?.transcript?.trim())
                      .filter(Boolean)
                      .join(" ")

        return new Response(
            JSON.stringify({
                text: text || ""
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" }
            }
        )
    } catch (error) {
        console.error("Speech-to-text error:", error)
        return new Response(JSON.stringify({ error: `Internal server error: ${error}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        })
    }
})
