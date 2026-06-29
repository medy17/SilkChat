import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserIdentityMock, createProviderMock, createOpenAIMock } = vi.hoisted(() => ({
    getUserIdentityMock: vi.fn(),
    createProviderMock: vi.fn(),
    createOpenAIMock: vi.fn()
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/lib/provider_factory", () => ({
    createProvider: createProviderMock
}))

vi.mock("@ai-sdk/openai", () => ({
    createOpenAI: createOpenAIMock
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        settings: {
            getUserRegistryInternal: "getUserRegistryInternal"
        }
    }
}))

vi.mock("../../convex/lib/models", () => ({
    MODELS_SHARED: [
        {
            id: "shared-text",
            name: "Shared Text",
            mode: "text",
            abilities: ["reasoning"],
            adapters: ["openrouter:or-shared"],
            prototypeCreditTier: "basic",
            prototypeCreditTierWithReasoning: "pro"
        },
        {
            id: "legacy-internal-text",
            name: "Legacy Internal Text",
            mode: "text",
            abilities: ["reasoning"],
            adapters: ["i3-openai:legacy-text", "openrouter:or-legacy-text"]
        }
    ]
}))

import { ChatError } from "@/lib/errors"
import { getModel } from "../../convex/chat_http/get_model"

type GetModelCtx = Parameters<typeof getModel>[0]

const createCtx = (registry: Record<string, unknown>) =>
    ({
        auth: {},
        runQuery: vi.fn().mockResolvedValue(registry)
    }) as unknown as GetModelCtx

describe("getModel", () => {
    beforeEach(() => {
        getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" })
        createProviderMock.mockReset()
        createOpenAIMock.mockReset()
        Reflect.deleteProperty(process.env, "OPENROUTER_API_KEY")
    })

    it("returns unauthorized when the user identity cannot be resolved", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ error: "Unauthorized" })

        await expect(
            getModel(createCtx({ models: {}, providers: {} }), "shared-text")
        ).rejects.toMatchObject({
            type: "unauthorized"
        })
    })

    it("uses internal OpenRouter for shared models when an internal key is configured", async () => {
        process.env.OPENROUTER_API_KEY = "internal-openrouter-key"
        const openRouterModel = { provider: "internal-openrouter" }
        createProviderMock.mockResolvedValueOnce({
            chat: vi.fn().mockReturnValue(openRouterModel)
        })

        const result = await getModel(
            createCtx({
                providers: {},
                models: {
                    "shared-text": {
                        id: "shared-text",
                        name: "Shared Text",
                        mode: "text",
                        abilities: ["reasoning"],
                        adapters: ["openrouter:or-shared"]
                    }
                }
            }),
            "shared-text"
        )

        expect(createProviderMock).toHaveBeenCalledWith("openrouter", "internal", {
            modelId: "or-shared"
        })
        expect(result).toMatchObject({
            providerSource: "internal",
            runtimeProvider: "openrouter",
            model: {
                provider: "internal-openrouter",
                modelType: "text"
            }
        })
    })

    it("uses OpenRouter BYOK first for shared models when OpenRouter is set to priority", async () => {
        const openRouterModel = { provider: "byok-openrouter" }
        createProviderMock.mockResolvedValueOnce({
            chat: vi.fn().mockReturnValue(openRouterModel)
        })

        const result = await getModel(
            createCtx({
                providers: {
                    openrouter: {
                        key: "user-openrouter-key",
                        usageMode: "priority"
                    }
                },
                models: {
                    "shared-text": {
                        id: "shared-text",
                        name: "Shared Text",
                        mode: "text",
                        abilities: ["reasoning"],
                        adapters: ["openrouter:or-shared"]
                    }
                }
            }),
            "shared-text"
        )

        expect(createProviderMock).toHaveBeenCalledWith("openrouter", "user-openrouter-key", {
            modelId: "or-shared"
        })
        expect(result).toMatchObject({
            providerSource: "openrouter",
            runtimeProvider: "openrouter",
            model: {
                provider: "byok-openrouter",
                modelType: "text"
            }
        })
    })

    it("uses custom OpenAI-compatible providers for custom models", async () => {
        const customModel = { provider: "custom-openai-compatible" }
        const chatMock = vi.fn().mockReturnValue(customModel)
        const responsesMock = vi.fn()
        createOpenAIMock.mockReturnValueOnce({
            chat: chatMock,
            responses: responsesMock
        })

        const result = await getModel(
            createCtx({
                providers: {
                    customProvider: {
                        key: "custom-key",
                        endpoint: "https://custom.example/v1",
                        name: "Custom Provider",
                        apiMode: "chat"
                    }
                },
                models: {
                    "custom-model": {
                        id: "my-model-id",
                        name: "My Custom Model",
                        mode: "text",
                        abilities: ["reasoning"],
                        customProviderId: "customProvider",
                        adapters: ["customProvider:my-model-id"]
                    }
                }
            }),
            "custom-model"
        )

        expect(createOpenAIMock).toHaveBeenCalledWith({
            baseURL: "https://custom.example/v1",
            apiKey: "custom-key",
            name: "Custom Provider"
        })
        expect(chatMock).toHaveBeenCalledWith("my-model-id")
        expect(responsesMock).not.toHaveBeenCalled()
        expect(result).toMatchObject({
            modelId: "my-model-id",
            modelName: "My Custom Model",
            providerSource: "custom",
            runtimeProvider: "custom",
            model: {
                provider: "custom-openai-compatible",
                modelType: "text"
            }
        })
    })

    it("uses the Responses API for custom providers configured that way", async () => {
        const customModel = { provider: "custom-openai-compatible-responses" }
        const chatMock = vi.fn()
        const responsesMock = vi.fn().mockReturnValue(customModel)
        createOpenAIMock.mockReturnValueOnce({
            chat: chatMock,
            responses: responsesMock
        })

        const result = await getModel(
            createCtx({
                providers: {
                    customProvider: {
                        key: "custom-key",
                        endpoint: "https://custom.example/v1",
                        name: "Custom Provider",
                        apiMode: "responses"
                    }
                },
                models: {
                    "custom-model": {
                        id: "my-model-id",
                        name: "My Custom Model",
                        mode: "text",
                        abilities: ["reasoning"],
                        customProviderId: "customProvider",
                        adapters: ["customProvider:my-model-id"]
                    }
                }
            }),
            "custom-model"
        )

        expect(chatMock).not.toHaveBeenCalled()
        expect(responsesMock).toHaveBeenCalledWith("my-model-id")
        expect(result).toMatchObject({
            providerSource: "custom",
            runtimeProvider: "custom",
            model: {
                provider: "custom-openai-compatible-responses",
                modelType: "text"
            }
        })
    })

    it("uses OpenRouter BYOK for custom OpenRouter models", async () => {
        const openRouterModel = { provider: "custom-openrouter" }
        createProviderMock.mockResolvedValueOnce({
            chat: vi.fn().mockReturnValue(openRouterModel)
        })

        const result = await getModel(
            createCtx({
                providers: {
                    openrouter: {
                        key: "user-openrouter-key",
                        usageMode: "fallback"
                    }
                },
                models: {
                    "custom-openrouter-model": {
                        id: "vendor/custom-model",
                        name: "Custom OpenRouter Model",
                        mode: "text",
                        abilities: ["reasoning"],
                        customProviderId: "openrouter",
                        adapters: ["openrouter:vendor/custom-model"]
                    }
                }
            }),
            "custom-openrouter-model"
        )

        expect(createProviderMock).toHaveBeenCalledWith("openrouter", "user-openrouter-key", {
            modelId: "vendor/custom-model"
        })
        expect(result).toMatchObject({
            modelId: "vendor/custom-model",
            providerSource: "openrouter",
            runtimeProvider: "openrouter",
            model: {
                provider: "custom-openrouter",
                modelType: "text"
            }
        })
    })

    it("does not run custom OpenRouter models with the internal OpenRouter key", async () => {
        process.env.OPENROUTER_API_KEY = "internal-openrouter-key"

        const result = await getModel(
            createCtx({
                providers: {},
                models: {
                    "custom-openrouter-model": {
                        id: "vendor/custom-model",
                        name: "Custom OpenRouter Model",
                        mode: "text",
                        abilities: ["reasoning"],
                        customProviderId: "openrouter",
                        adapters: ["openrouter:vendor/custom-model"]
                    }
                }
            }),
            "custom-openrouter-model"
        )

        expect(createProviderMock).not.toHaveBeenCalled()
        expect(result).toBeInstanceOf(ChatError)
        expect((result as ChatError).type).toBe("bad_model")
    })

    it("returns a bad_model error when internalOnly has no hosted adapter", async () => {
        const result = await getModel(
            createCtx({
                providers: {},
                models: {
                    "custom-model": {
                        id: "my-model-id",
                        name: "My Custom Model",
                        mode: "text",
                        abilities: ["reasoning"],
                        customProviderId: "customProvider",
                        adapters: ["customProvider:my-model-id"]
                    }
                }
            }),
            "custom-model",
            {
                internalOnly: true
            }
        )

        expect(result).toBeInstanceOf(ChatError)
        expect((result as ChatError).type).toBe("bad_model")
        expect((result as ChatError).cause).toBe("No internal adapters found for model")
    })
})
