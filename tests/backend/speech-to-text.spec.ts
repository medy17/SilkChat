import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserIdentityMock, decryptKeyMock } = vi.hoisted(() => ({
    getUserIdentityMock: vi.fn(),
    decryptKeyMock: vi.fn()
}))

vi.mock("../../convex/_generated/server", () => ({
    httpAction: (handler: unknown) => handler
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        settings: {
            getUserSettingsInternal: "getUserSettingsInternal"
        }
    }
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/lib/account_deletion_gate", () => ({
    getAccountDeletionBlockerForAction: vi.fn().mockResolvedValue(null)
}))

vi.mock("../../convex/lib/encryption", () => ({
    decryptKey: decryptKeyMock
}))

import { transcribeAudio } from "../../convex/speech_to_text"

const transcribeAudioHandler = transcribeAudio as unknown as (
    ctx: {
        auth: Record<string, never>
        runQuery: ReturnType<typeof vi.fn>
    },
    request: Request
) => Promise<Response>

type SpeechCtx = Parameters<typeof transcribeAudioHandler>[0]

const createCtx = (settings?: Record<string, unknown>) =>
    ({
        auth: {},
        runQuery: vi.fn().mockResolvedValue(settings ?? { coreAIProviders: {} })
    }) as SpeechCtx

const createAudioRequest = (audio?: Blob) => {
    const formData = new FormData()
    if (audio) formData.append("audio", audio, "audio.webm")

    return new Request("https://example.com/transcribe", {
        method: "POST",
        body: formData
    })
}

describe("transcribeAudio", () => {
    beforeEach(() => {
        getUserIdentityMock.mockReset()
        decryptKeyMock.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "log").mockImplementation(() => {})
        vi.unstubAllGlobals()
        Reflect.deleteProperty(process.env, "OPENROUTER_API_KEY")
    })

    it("returns 401 for unauthorized users", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ error: "Unauthorized" })

        const response = await transcribeAudioHandler(createCtx(), createAudioRequest())

        expect(response.status).toBe(401)
        await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
    })

    it("rejects missing audio files and oversized uploads before calling the provider", async () => {
        getUserIdentityMock.mockResolvedValue({ id: "user-1" })
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        const missingResponse = await transcribeAudioHandler(createCtx(), createAudioRequest())
        expect(missingResponse.status).toBe(400)
        await expect(missingResponse.json()).resolves.toEqual({
            error: "No audio file provided"
        })

        const oversizedAudio = new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], {
            type: "audio/webm"
        })
        const largeResponse = await transcribeAudioHandler(
            createCtx(),
            createAudioRequest(oversizedAudio)
        )
        expect(largeResponse.status).toBe(400)
        await expect(largeResponse.json()).resolves.toEqual({
            error: "Audio file too large (max 25MB)"
        })

        const unsupportedResponse = await transcribeAudioHandler(
            createCtx(),
            createAudioRequest(new Blob(["abc"], { type: "audio/webm" }))
        )
        expect(unsupportedResponse.status).toBe(400)
        await expect(unsupportedResponse.json()).resolves.toEqual({
            error: "Unsupported transcription audio format. Please record again."
        })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("returns a configuration error when no OpenRouter key is available", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })

        const response = await transcribeAudioHandler(
            createCtx(),
            createAudioRequest(new Blob(["abc"], { type: "audio/wav" }))
        )

        expect(response.status).toBe(500)
        await expect(response.json()).resolves.toEqual({
            error: "Voice input service not configured. Configure OpenRouter in AI Options or set OPENROUTER_API_KEY in Convex."
        })
    })

    it("uses OpenRouter BYOK before the internal key and returns the transcript", async () => {
        process.env.OPENROUTER_API_KEY = "internal-key"
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        decryptKeyMock.mockResolvedValueOnce("user-key")
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ text: "  hello world  " }), { status: 200 })
            )
        vi.stubGlobal("fetch", fetchMock)

        const response = await transcribeAudioHandler(
            createCtx({
                coreAIProviders: {
                    openrouter: { enabled: true, encryptedKey: "encrypted-key" }
                }
            }),
            createAudioRequest(new Blob(["abc"], { type: "audio/wav" }))
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ text: "hello world" })
        expect(fetchMock).toHaveBeenCalledTimes(1)

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe("https://openrouter.ai/api/v1/audio/transcriptions")
        expect(init.method).toBe("POST")
        expect(init.headers).toMatchObject({
            Authorization: "Bearer user-key",
            "HTTP-Referer": "https://silkchat.dev",
            "X-OpenRouter-Title": "SilkChat",
            "X-OpenRouter-Categories": "general-chat"
        })
        const providerForm = init.body as FormData
        expect(providerForm.get("model")).toBe("microsoft/mai-transcribe-2")
        expect(providerForm.get("file")).toBeInstanceOf(Blob)
    })

    it("falls back to the internal OpenRouter key", async () => {
        process.env.OPENROUTER_API_KEY = "internal-key"
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(JSON.stringify({ text: "hello" }), { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)

        await transcribeAudioHandler(
            createCtx(),
            createAudioRequest(new Blob(["abc"], { type: "audio/ogg" }))
        )

        expect(fetchMock).toHaveBeenCalledWith(
            "https://openrouter.ai/api/v1/audio/transcriptions",
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer internal-key" })
            })
        )
    })

    it.each([
        [401, 500, "Invalid OpenRouter credentials. Please check your configuration."],
        [402, 402, "OpenRouter credits are required to use voice input."],
        [429, 429, "Rate limit exceeded. Please try again later."]
    ])("maps OpenRouter %i errors", async (providerStatus, expectedStatus, expectedError) => {
        process.env.OPENROUTER_API_KEY = "internal-key"
        getUserIdentityMock.mockResolvedValueOnce({ id: "user-1" })
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("provider error", { status: providerStatus }))
        )

        const response = await transcribeAudioHandler(
            createCtx(),
            createAudioRequest(new Blob(["abc"], { type: "audio/wav" }))
        )

        expect(response.status).toBe(expectedStatus)
        await expect(response.json()).resolves.toEqual({ error: expectedError })
    })
})
