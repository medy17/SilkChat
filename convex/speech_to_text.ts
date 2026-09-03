import { internal } from "./_generated/api"
import { type ActionCtx, httpAction } from "./_generated/server"
import { getAccountDeletionBlockerForAction } from "./lib/account_deletion_gate"
import { decryptKey } from "./lib/encryption"
import { getUserIdentity } from "./lib/identity"
import { COMPOSER_TRANSCRIPTION_MODEL } from "./lib/models/microsoft"
import { getTranscriptionAudioFormat } from "./lib/models/transcription"
import type { TranscriptionConfig } from "./lib/models/types"
import { getOpenRouterAttribution } from "./lib/openrouter_attribution"

const OPENROUTER_STT_URL = "https://openrouter.ai/api/v1/audio/transcriptions"
const MAX_AUDIO_SIZE = 25 * 1024 * 1024
const resolveComposerTranscriptionConfig = () => {
    const modelId = COMPOSER_TRANSCRIPTION_MODEL.adapters
        .find((adapter) => adapter.startsWith("openrouter:"))
        ?.slice("openrouter:".length)
    const config: TranscriptionConfig | undefined = COMPOSER_TRANSCRIPTION_MODEL.transcription

    if (!modelId || !config) {
        throw new Error(
            "Composer transcription model is missing its OpenRouter audio configuration"
        )
    }

    return { modelId, config }
}

const { modelId: OPENROUTER_STT_MODEL, config: TRANSCRIPTION_CONFIG } =
    resolveComposerTranscriptionConfig()

async function getOpenRouterApiKey(
    ctx: Pick<ActionCtx, "runQuery">,
    userId: string
): Promise<string> {
    const settings = await ctx.runQuery(internal.settings.getUserSettingsInternal, { userId })
    const openRouterProvider = settings.coreAIProviders?.openrouter

    if (openRouterProvider?.enabled && openRouterProvider.encryptedKey) {
        try {
            const decryptedKey = await decryptKey(openRouterProvider.encryptedKey)
            if (decryptedKey.trim()) {
                console.log("Using user's OpenRouter credentials for speech-to-text")
                return decryptedKey.trim()
            }
        } catch (error) {
            console.warn(
                "Failed to get user's OpenRouter credentials, falling back to internal configuration:",
                error
            )
        }
    }

    const internalKey = process.env.OPENROUTER_API_KEY?.trim()
    if (internalKey) {
        console.log("Using internal OpenRouter credentials for speech-to-text")
        return internalKey
    }

    throw new Error(
        "Voice input service not configured. Configure OpenRouter in AI Options or set OPENROUTER_API_KEY in Convex."
    )
}

async function transcribeWithOpenRouter(
    ctx: Pick<ActionCtx, "runQuery">,
    userId: string,
    audioFile: Blob
) {
    const apiKey = await getOpenRouterApiKey(ctx, userId)
    const attribution = getOpenRouterAttribution()
    const audioFormat = getTranscriptionAudioFormat(audioFile.type)
    if (!audioFormat) throw new Error("Unknown transcription audio format")
    const formData = new FormData()
    formData.append("file", audioFile, `audio.${audioFormat}`)
    formData.append("model", OPENROUTER_STT_MODEL)

    return await fetch(OPENROUTER_STT_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": attribution.appUrl,
            "X-OpenRouter-Title": attribution.appName,
            ...attribution.headers
        },
        body: formData
    })
}

const jsonResponse = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    })

export const transcribeAudio = httpAction(async (ctx, request) => {
    try {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            console.error("Unauthorized")
            return jsonResponse({ error: "Unauthorized" }, 401)
        }
        if (await getAccountDeletionBlockerForAction(ctx, user.id)) {
            return jsonResponse({ error: "Account deletion is in progress" }, 403)
        }

        const formData = await request.formData()
        const audioFile = formData.get("audio")

        if (!(audioFile instanceof Blob)) {
            console.error("No audio file provided")
            return jsonResponse({ error: "No audio file provided" }, 400)
        }

        if (audioFile.size > MAX_AUDIO_SIZE) {
            console.error("Audio file too large (max 25MB)")
            return jsonResponse({ error: "Audio file too large (max 25MB)" }, 400)
        }

        const audioFormat = getTranscriptionAudioFormat(audioFile.type)
        if (!audioFormat || !TRANSCRIPTION_CONFIG.acceptedFormats.includes(audioFormat)) {
            return jsonResponse(
                { error: "Unsupported transcription audio format. Please record again." },
                400
            )
        }

        console.log(
            `Transcribing audio with OpenRouter: ${audioFile.size} bytes, type: ${audioFile.type}`
        )

        let response: Response
        try {
            response = await transcribeWithOpenRouter(ctx, user.id, audioFile)
        } catch (error) {
            return jsonResponse(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Voice input service not configured."
                },
                500
            )
        }

        if (!response.ok) {
            const errorText = await response.text()
            console.error("OpenRouter speech-to-text API error:", response.status, errorText)

            if (response.status === 401) {
                return jsonResponse(
                    { error: "Invalid OpenRouter credentials. Please check your configuration." },
                    500
                )
            }
            if (response.status === 402) {
                return jsonResponse(
                    { error: "OpenRouter credits are required to use voice input." },
                    402
                )
            }
            if (response.status === 403) {
                return jsonResponse(
                    {
                        error: "OpenRouter speech-to-text access was denied. Check your key permissions."
                    },
                    500
                )
            }
            if (response.status === 429) {
                return jsonResponse({ error: "Rate limit exceeded. Please try again later." }, 429)
            }

            return jsonResponse({ error: "Transcription service temporarily unavailable" }, 500)
        }

        const transcriptionResult = (await response.json()) as { text?: string }
        return jsonResponse({ text: transcriptionResult.text?.trim() || "" }, 200)
    } catch (error) {
        console.error("Speech-to-text error:", error)
        return jsonResponse({ error: `Internal server error: ${error}` }, 500)
    }
})
