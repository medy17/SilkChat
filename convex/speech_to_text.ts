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
const CHIRP_MODEL = "chirp_3"

type GoogleSpeechConfig = {
    project: string
    location: string
    credentials: {
        client_email: string
        private_key: string
    }
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

async function getGoogleSpeechConfig(
    ctx: Pick<ActionCtx, "runQuery">,
    userId: string
): Promise<GoogleSpeechConfig> {
    const settings = await ctx.runQuery(internal.settings.getUserSettingsInternal, { userId })
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

export const transcribeAudio = httpAction(async (ctx, request) => {
    try {
        // Verify user authentication
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            console.error("Unauthorized")
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            })
        }

        try {
            // Validate speech credentials before reading the full audio payload.
            await getGoogleSpeechConfig(ctx, user.id)
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

        // Parse the form data
        const formData = await request.formData()
        const audioFile = formData.get("audio") as Blob

        if (!audioFile) {
            console.error("No audio file provided")
            return new Response(JSON.stringify({ error: "No audio file provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            })
        }

        // Keep uploads bounded so transcription requests stay responsive.
        const maxSize = 25 * 1024 * 1024 // 25MB
        if (audioFile.size > maxSize) {
            console.error("Audio file too large (max 25MB)")
            return new Response(JSON.stringify({ error: "Audio file too large (max 25MB)" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            })
        }

        // Determine appropriate filename extension based on MIME type
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
            // Default fallback for browsers that omit a precise audio subtype.
            return "audio.webm"
        }

        const filename = getFilenameFromMimeType(audioFile.type)
        console.log(
            `Transcribing audio: ${audioFile.size} bytes, type: ${audioFile.type}, filename: ${filename}`
        )

        const speechConfig = await getGoogleSpeechConfig(ctx, user.id)
        const accessToken = await getGoogleAccessToken(
            speechConfig.credentials.client_email,
            speechConfig.credentials.private_key
        )
        const audioBase64 = arrayBufferToBase64(await audioFile.arrayBuffer())
        const recognizer = `projects/${speechConfig.project}/locations/${speechConfig.location}/recognizers/_`
        const baseUrl = getSpeechApiBaseUrl(speechConfig.location)

        const response = await fetch(`${baseUrl}/v2/${recognizer}:recognize`, {
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

        if (!response.ok) {
            const errorText = await response.text()
            console.error("Google Speech API error:", response.status, errorText)

            // Handle specific error cases
            if (response.status === 401) {
                console.error("Invalid Google credentials. Please check configuration.")
                return new Response(
                    JSON.stringify({
                        error: "Invalid Google credentials. Please check your Vertex configuration."
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" }
                    }
                )
            }
            if (response.status === 403) {
                console.error("Google Speech access forbidden.")
                return new Response(
                    JSON.stringify({
                        error: "Google Speech-to-Text access was denied. Ensure the service account can use Speech-to-Text V2."
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" }
                    }
                )
            }
            if (response.status === 429) {
                console.error("Rate limit exceeded. Please try again later.")
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
            results?: Array<{
                alternatives?: Array<{
                    transcript?: string
                }>
                languageCode?: string
            }>
        }
        const text = transcriptionResult.results
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
