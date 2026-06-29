import { beforeEach, describe, expect, it, vi } from "vitest"

const { createOpenRouterMock } = vi.hoisted(() => ({
    createOpenRouterMock: vi.fn()
}))

vi.mock("@openrouter/ai-sdk-provider", () => ({
    createOpenRouter: createOpenRouterMock
}))

import { createProvider } from "../../convex/lib/provider_factory"

describe("provider_factory", () => {
    beforeEach(() => {
        createOpenRouterMock.mockReset()
        vi.unstubAllEnvs()
    })

    it("rejects blank non-internal API keys", async () => {
        await expect(createProvider("openrouter", "   ")).rejects.toThrow(
            "API key is required for non-internal providers"
        )
    })

    it("rejects internal OpenRouter usage when no key is configured", async () => {
        vi.stubEnv("OPENROUTER_API_KEY", "")

        await expect(createProvider("openrouter", "internal")).rejects.toThrow(
            "OpenRouter API key is required"
        )
    })

    it("adds OpenRouter attribution headers and app metadata", async () => {
        vi.stubEnv("VITE_BETTER_AUTH_URL", "https://silkchat.dev")
        createOpenRouterMock.mockReturnValueOnce({ provider: "openrouter" })

        const provider = await createProvider("openrouter", "openrouter-key")

        expect(createOpenRouterMock).toHaveBeenCalledWith({
            apiKey: "openrouter-key",
            compatibility: "strict",
            appName: "SilkChat",
            appUrl: "https://silkchat.dev",
            headers: {
                "X-OpenRouter-Categories": "general-chat"
            }
        })
        expect(provider).toEqual({ provider: "openrouter" })
    })
})
