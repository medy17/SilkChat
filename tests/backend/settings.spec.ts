import { beforeEach, describe, expect, it, vi } from "vitest"

const { decryptKeyMock, encryptKeyMock, getUserIdentityMock } = vi.hoisted(() => ({
    decryptKeyMock: vi.fn(),
    encryptKeyMock: vi.fn(),
    getUserIdentityMock: vi.fn()
}))

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return {
        v: new Proxy(
            {},
            {
                get: () => passthrough
            }
        )
    }
})

vi.mock("../../convex/_generated/server", () => ({
    internalQuery: (config: unknown) => config,
    query: (config: unknown) => config,
    mutation: (config: unknown) => config
}))

vi.mock("@/lib/default-user-settings", () => ({
    DefaultSettings: (userId: string) => ({
        userId,
        searchProvider: "firecrawl",
        searchIncludeSourcesByDefault: false,
        coreAIProviders: {},
        customAIProviders: {},
        customModels: {},
        titleGenerationModel: "gemini-3.1-flash-lite",
        toolCallLimitPerTurn: 3,
        customThemes: [],
        mcpServers: [],
        invertSendNewlineBehavior: false,
        generalProviders: {
            supermemory: undefined,
            firecrawl: undefined,
            tavily: undefined,
            brave: undefined,
            serper: undefined
        },
        customization: undefined,
        onboardingCompleted: false
    })
}))

vi.mock("../../convex/lib/encryption", () => ({
    decryptKey: decryptKeyMock,
    encryptKey: encryptKeyMock
}))

vi.mock("../../convex/lib/account_deletion_status", () => ({
    assertAccountNotDeleting: vi.fn()
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/lib/models", () => ({
    MODELS_SHARED: [
        {
            id: "shared-text",
            name: "Shared Text",
            abilities: ["reasoning"],
            mode: "text",
            adapters: ["i3-openai:shared-text", "openrouter:or-shared", "openai:shared-text"],
            contextLength: 128000,
            maxTokens: 8192,
            knowledgeCutoff: "2024-01-01",
            inputUsdPer1MTokens: 1.25,
            outputUsdPer1MTokens: 10,
            hostedContextLength: 48000,
            maxPerMessage: 4,
            supportsReferenceImages: true,
            openrouterImageModalities: undefined,
            supportedImageSizes: ["1:1"],
            supportedImageResolutions: ["1K"]
        },
        {
            id: "admin-text",
            name: "Admin Text",
            abilities: ["reasoning"],
            mode: "text",
            adapters: ["i3-openai:admin-text"],
            requiredRole: "admin"
        }
    ],
    SHARED_MODELS_VERSION: "test-version",
    isModelSunset: (model: { sunsetOn?: string }) =>
        Boolean(model.sunsetOn && model.sunsetOn <= "2026-04-20")
}))

vi.mock("../../convex/schema", () => ({
    UserSettings: {}
}))

vi.mock("../../convex/schema/settings", () => ({
    ImageGenerationDefaults: {},
    NonSensitiveUserSettings: {},
    StoredModelAbilitySchema: {}
}))

import { ChatError } from "@/lib/errors"
import { MODELS_SHARED as SETTINGS_TEST_MODELS } from "../../convex/lib/models"
import {
    addUserTheme,
    deleteUserTheme,
    getSharedModels,
    getUserRegistryInternal,
    updateUserSettings,
    updateUserSettingsPartial
} from "../../convex/settings"

const getUserRegistryInternalHandler = getUserRegistryInternal as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const getSharedModelsHandler = getSharedModels as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const updateUserSettingsHandler = updateUserSettings as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const updateUserSettingsPartialHandler = updateUserSettingsPartial as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const addUserThemeHandler = addUserTheme as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const deleteUserThemeHandler = deleteUserTheme as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}

type SettingsCtx = Parameters<typeof getUserRegistryInternalHandler.handler>[0]

const createCtx = (
    settings: Record<string, unknown> | null,
    options: { userAccess?: Record<string, unknown> | null } = {}
) =>
    ({
        auth: {},
        db: {
            query: vi.fn((tableName: string) => ({
                withIndex: vi.fn().mockReturnValue({
                    first: vi
                        .fn()
                        .mockResolvedValue(
                            tableName === "userAccess"
                                ? (options.userAccess ?? null)
                                : tableName === "modelProviderMetadata"
                                  ? null
                                  : settings
                        )
                })
            })),
            patch: vi.fn(),
            insert: vi.fn()
        }
    }) as SettingsCtx

describe("settings", () => {
    beforeEach(() => {
        decryptKeyMock.mockReset().mockImplementation(async (value: string) => `dec:${value}`)
        encryptKeyMock.mockReset().mockImplementation(async (value: string) => `enc:${value}`)
        getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" })
        Reflect.deleteProperty(process.env, "OPENROUTER_API_KEY")
        Reflect.deleteProperty(process.env, "PERPLEXITY_API_KEY")
    })

    it("builds a registry with enabled BYOK providers, internal providers, and custom models", async () => {
        process.env.OPENROUTER_API_KEY = "or-key"

        const result = await getUserRegistryInternalHandler.handler(
            createCtx({
                userId: "user-1",
                coreAIProviders: {
                    openai: {
                        enabled: true,
                        encryptedKey: "openai-key",
                        authMode: "ai-studio"
                    },
                    gateway: {
                        enabled: true,
                        encryptedKey: "gateway-key"
                    }
                },
                customAIProviders: {
                    customprov: {
                        enabled: true,
                        encryptedKey: "custom-key",
                        endpoint: "https://custom.example.com/v1",
                        name: "Custom Provider"
                    }
                },
                customModels: {
                    "custom-model": {
                        enabled: true,
                        providerId: "customprov",
                        modelId: "custom-model-id",
                        name: "Custom Model",
                        abilities: ["reasoning"],
                        contextLength: 32000,
                        maxTokens: 8000
                    }
                },
                generalProviders: {}
            }),
            { userId: "user-1" }
        )

        expect(result.providers).toEqual({
            openai: {
                key: "dec:openai-key",
                name: "openai",
                usageMode: "fallback",
                authMode: "ai-studio"
            },
            gateway: {
                key: "dec:gateway-key",
                name: "gateway",
                usageMode: "fallback",
                authMode: undefined
            },
            customprov: {
                key: "dec:custom-key",
                endpoint: "https://custom.example.com/v1",
                apiMode: "chat",
                name: "Custom Provider"
            }
        })
        expect(result.models["shared-text"].adapters).toEqual([
            "i3-openai:shared-text",
            "openrouter:or-shared",
            "openai:shared-text"
        ])
        expect(result.models["shared-text"]).toMatchObject({
            contextLength: 128000,
            maxTokens: 8192,
            inputUsdPer1MTokens: 1.25,
            outputUsdPer1MTokens: 10,
            hostedContextLength: 48000
        })
        expect(result.models["admin-text"]).toBeUndefined()
        expect(result.models["custom-model"]).toMatchObject({
            id: "custom-model-id",
            name: "Custom Model",
            adapters: ["customprov:custom-model-id"],
            customProviderId: "customprov"
        })
    })

    it("keeps explicit shared-model metadata ahead of cached OpenRouter metadata", async () => {
        process.env.OPENROUTER_API_KEY = "or-key"

        const ctx = createCtx({
            userId: "user-1",
            coreAIProviders: {},
            customAIProviders: {},
            customModels: {},
            generalProviders: {}
        })
        ctx.db.query = vi.fn((tableName: string) => ({
            withIndex: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(async () => {
                    if (tableName === "userAccess") return null
                    if (tableName === "settings") {
                        return {
                            userId: "user-1",
                            coreAIProviders: {},
                            customAIProviders: {},
                            customModels: {},
                            generalProviders: {}
                        }
                    }
                    if (tableName === "modelProviderMetadata") {
                        return {
                            provider: "openrouter",
                            providerModelId: "or-shared",
                            contextLength: 256000,
                            maxCompletionTokens: 12000,
                            knowledgeCutoff: "2025-01-31",
                            inputUsdPer1MTokens: 0.5,
                            outputUsdPer1MTokens: 2,
                            fetchedAt: 123,
                            source: "openrouter"
                        }
                    }
                    return null
                })
            })
        }))

        const result = await getUserRegistryInternalHandler.handler(ctx, { userId: "user-1" })

        expect(result.models["shared-text"]).toMatchObject({
            contextLength: 128000,
            maxTokens: 8192,
            inputUsdPer1MTokens: 1.25,
            outputUsdPer1MTokens: 10
        })
    })

    it("includes admin-only shared models in the registry for staff users", async () => {
        const result = await getUserRegistryInternalHandler.handler(
            createCtx(
                {
                    userId: "user-1",
                    coreAIProviders: {},
                    customAIProviders: {},
                    customModels: {},
                    generalProviders: {}
                },
                {
                    userAccess: {
                        userId: "user-1",
                        isStaff: true,
                        bypassLimits: false
                    }
                }
            ),
            { userId: "user-1" }
        )

        expect(result.models["admin-text"]).toMatchObject({
            id: "admin-text",
            requiredRole: "admin",
            adapters: []
        })
    })

    it("filters shared admin-only models unless the current user is staff", async () => {
        const nonStaffResult = await getSharedModelsHandler.handler(createCtx(null), {})
        expect(nonStaffResult.models.map((model: { id: string }) => model.id)).toEqual([
            "shared-text"
        ])

        const staffResult = await getSharedModelsHandler.handler(
            createCtx(null, {
                userAccess: {
                    userId: "user-1",
                    isStaff: true,
                    bypassLimits: false
                }
            }),
            {}
        )
        expect(staffResult.models.map((model: { id: string }) => model.id)).toEqual([
            "shared-text",
            "admin-text"
        ])
    })

    it("adds synchronized OpenRouter metadata to the shared model catalog", async () => {
        const sharedModel = SETTINGS_TEST_MODELS[0]
        const originalKnowledgeCutoff = sharedModel.knowledgeCutoff
        const originalInputPrice = sharedModel.inputUsdPer1MTokens
        const originalOutputPrice = sharedModel.outputUsdPer1MTokens
        sharedModel.knowledgeCutoff = undefined
        sharedModel.inputUsdPer1MTokens = undefined
        sharedModel.outputUsdPer1MTokens = undefined

        const ctx = createCtx(null)
        ctx.db.query = vi.fn((tableName: string) => ({
            withIndex: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(async () => {
                    if (tableName === "userAccess") return null
                    if (tableName === "modelProviderMetadata") {
                        return {
                            provider: "openrouter",
                            providerModelId: "or-shared",
                            knowledgeCutoff: "2025-01-31",
                            inputUsdPer1MTokens: 0.5,
                            outputUsdPer1MTokens: 3,
                            fetchedAt: 456,
                            source: "openrouter"
                        }
                    }
                    return null
                })
            })
        }))

        try {
            const result = await getSharedModelsHandler.handler(ctx, {})

            expect(result.version).toBe("test-version:456")
            expect(result.models[0]).toMatchObject({
                id: "shared-text",
                knowledgeCutoff: "2025-01-31",
                inputUsdPer1MTokens: 0.5,
                outputUsdPer1MTokens: 3
            })
        } finally {
            sharedModel.knowledgeCutoff = originalKnowledgeCutoff
            sharedModel.inputUsdPer1MTokens = originalInputPrice
            sharedModel.outputUsdPer1MTokens = originalOutputPrice
        }
    })

    it("normalizes legacy custom-model pdf abilities to native_pdf in the registry", async () => {
        const result = await getUserRegistryInternalHandler.handler(
            createCtx({
                userId: "user-1",
                coreAIProviders: {},
                customAIProviders: {
                    customprov: {
                        enabled: true,
                        encryptedKey: "custom-key",
                        endpoint: "https://custom.example.com/v1",
                        name: "Custom Provider"
                    }
                },
                customModels: {
                    "custom-model": {
                        enabled: true,
                        providerId: "customprov",
                        modelId: "custom-model-id",
                        name: "Custom Model",
                        abilities: ["pdf"],
                        contextLength: 32000,
                        maxTokens: 8000
                    }
                },
                generalProviders: {}
            }),
            { userId: "user-1" }
        )

        expect(result.models["custom-model"]).toMatchObject({
            abilities: ["native_pdf"]
        })
    })

    it("preserves existing encrypted keys when updates omit newKey values", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            coreAIProviders: {
                openai: {
                    enabled: true,
                    encryptedKey: "existing-core-key",
                    authMode: "vertex"
                }
            },
            customAIProviders: {
                customprov: {
                    enabled: true,
                    endpoint: "https://custom.example.com/v1",
                    apiMode: "responses",
                    name: "Custom Provider",
                    encryptedKey: "existing-custom-key"
                }
            },
            generalProviders: {
                supermemory: {
                    enabled: true,
                    encryptedKey: "existing-supermemory-key"
                },
                firecrawl: undefined,
                tavily: undefined,
                brave: {
                    enabled: true,
                    encryptedKey: "existing-brave-key",
                    country: "us",
                    searchLang: "en",
                    safesearch: "moderate"
                },
                serper: undefined
            }
        })

        await updateUserSettingsHandler.handler(ctx, {
            userId: "user-1",
            baseSettings: {
                userId: "user-1",
                searchProvider: "brave",
                searchIncludeSourcesByDefault: true,
                customModels: {},
                customThemes: [],
                titleGenerationModel: "shared-text",
                toolCallLimitPerTurn: 3,
                mcpServers: [],
                customization: undefined,
                onboardingCompleted: true
            },
            coreProviders: {
                openai: {
                    enabled: true
                }
            },
            customProviders: {
                customprov: {
                    enabled: true,
                    endpoint: "https://custom.example.com/v1",
                    name: "Custom Provider"
                }
            },
            generalProviders: {
                supermemory: {
                    enabled: true
                }
            }
        })

        expect(ctx.db.patch).toHaveBeenCalledTimes(1)
        expect(ctx.db.patch).toHaveBeenCalledWith(
            "settings-id",
            expect.objectContaining({
                coreAIProviders: {
                    openai: {
                        enabled: true,
                        usageMode: "fallback",
                        authMode: "vertex",
                        encryptedKey: "existing-core-key"
                    }
                },
                customAIProviders: {
                    customprov: {
                        enabled: true,
                        endpoint: "https://custom.example.com/v1",
                        apiMode: "responses",
                        name: "Custom Provider",
                        encryptedKey: "existing-custom-key"
                    }
                },
                generalProviders: expect.objectContaining({
                    supermemory: {
                        enabled: true,
                        encryptedKey: "existing-supermemory-key"
                    },
                    brave: {
                        enabled: true,
                        encryptedKey: "existing-brave-key",
                        country: "us",
                        searchLang: "en",
                        safesearch: "moderate"
                    }
                })
            })
        )
        expect(encryptKeyMock).not.toHaveBeenCalled()
    })

    it("rejects updates when the authenticated user does not match the requested userId", async () => {
        getUserIdentityMock.mockResolvedValueOnce({ id: "other-user" })

        await expect(
            updateUserSettingsHandler.handler(createCtx(null), {
                userId: "user-1",
                baseSettings: {
                    userId: "user-1",
                    searchProvider: "firecrawl",
                    searchIncludeSourcesByDefault: false,
                    customModels: {},
                    customThemes: [],
                    titleGenerationModel: "shared-text",
                    toolCallLimitPerTurn: 3,
                    mcpServers: [],
                    customization: undefined,
                    onboardingCompleted: false
                },
                coreProviders: {},
                customProviders: {}
            })
        ).rejects.toBeInstanceOf(ChatError)
    })

    it("persists inverted composer enter behavior through partial settings updates", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            searchProvider: "firecrawl",
            searchIncludeSourcesByDefault: false,
            coreAIProviders: {},
            customAIProviders: {},
            customModels: {},
            titleGenerationModel: "shared-text",
            toolCallLimitPerTurn: 3,
            customThemes: [],
            mcpServers: [],
            invertSendNewlineBehavior: false,
            generalProviders: {
                supermemory: undefined,
                firecrawl: undefined,
                tavily: undefined,
                brave: undefined,
                serper: undefined
            },
            customization: undefined,
            onboardingCompleted: false
        })

        await updateUserSettingsPartialHandler.handler(ctx, {
            invertSendNewlineBehavior: true
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "settings-id",
            expect.objectContaining({
                invertSendNewlineBehavior: true
            })
        )
    })

    it("removes cleared personalization fields through partial settings updates", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            searchProvider: "firecrawl",
            searchIncludeSourcesByDefault: false,
            coreAIProviders: {},
            customAIProviders: {},
            customModels: {},
            titleGenerationModel: "shared-text",
            toolCallLimitPerTurn: 3,
            customThemes: [],
            mcpServers: [],
            invertSendNewlineBehavior: false,
            generalProviders: {
                supermemory: undefined,
                firecrawl: undefined,
                tavily: undefined,
                brave: undefined,
                serper: undefined
            },
            customization: {
                name: "Ahmed",
                aiPersonality: "Be concise",
                additionalContext: "I write TypeScript"
            },
            onboardingCompleted: false
        })

        await updateUserSettingsPartialHandler.handler(ctx, {
            customization: { aiPersonality: null }
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "settings-id",
            expect.objectContaining({
                customization: {
                    name: "Ahmed",
                    additionalContext: "I write TypeScript"
                }
            })
        )
    })

    it("persists tool call limits through partial settings updates", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            searchProvider: "firecrawl",
            searchIncludeSourcesByDefault: false,
            coreAIProviders: {},
            customAIProviders: {},
            customModels: {},
            titleGenerationModel: "shared-text",
            toolCallLimitPerTurn: 3,
            customThemes: [],
            mcpServers: [],
            invertSendNewlineBehavior: false,
            generalProviders: {
                supermemory: undefined,
                firecrawl: undefined,
                tavily: undefined,
                brave: undefined,
                serper: undefined
            },
            customization: undefined,
            onboardingCompleted: false
        })

        await updateUserSettingsPartialHandler.handler(ctx, {
            toolCallLimitPerTurn: 7
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "settings-id",
            expect.objectContaining({
                toolCallLimitPerTurn: 7
            })
        )
    })

    it("merges image generation defaults so a partial update preserves the other field", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            searchProvider: "firecrawl",
            searchIncludeSourcesByDefault: false,
            coreAIProviders: {},
            customAIProviders: {},
            customModels: {},
            titleGenerationModel: "shared-text",
            toolCallLimitPerTurn: 3,
            customThemes: [],
            mcpServers: [],
            invertSendNewlineBehavior: false,
            imageGenerationDefaults: { variants: 3 },
            generalProviders: {
                supermemory: undefined,
                firecrawl: undefined,
                tavily: undefined,
                brave: undefined,
                serper: undefined
            },
            customization: undefined,
            onboardingCompleted: false
        })

        await updateUserSettingsPartialHandler.handler(ctx, {
            imageGenerationDefaults: { resolution: "2K" }
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "settings-id",
            expect.objectContaining({
                imageGenerationDefaults: { variants: 3, resolution: "2K" }
            })
        )
    })

    it("adds a normalized imported theme to synced settings", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            customModels: {},
            customThemes: ["https://tweakcn.com/themes/one"]
        })

        await addUserThemeHandler.handler(ctx, {
            url: "  https://tweakcn.com/themes/two  "
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "settings-id",
            expect.objectContaining({
                customThemes: ["https://tweakcn.com/themes/one", "https://tweakcn.com/themes/two"]
            })
        )
    })

    it("rejects an imported theme after the sync limit is reached", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            customModels: {},
            customThemes: Array.from(
                { length: 5 },
                (_, index) => `https://tweakcn.com/themes/${index}`
            )
        })

        await expect(
            addUserThemeHandler.handler(ctx, { url: "https://tweakcn.com/themes/overflow" })
        ).rejects.toThrow("You can save up to 5 themes")
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("does not consume a saved slot when importing a built-in theme", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            customModels: {},
            customThemes: Array.from(
                { length: 5 },
                (_, index) => `https://tweakcn.com/themes/${index}`
            )
        })

        await addUserThemeHandler.handler(ctx, {
            url: "https://tweakcn.com/editor/theme?theme=vercel"
        })

        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("rejects unsupported theme URLs", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            customModels: {},
            customThemes: []
        })

        await expect(
            addUserThemeHandler.handler(ctx, {
                url: "https://example.com/themes/theme-id"
            })
        ).rejects.toThrow("Enter a theme URL from tweakcn.com")
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("removes an imported theme from synced settings", async () => {
        const ctx = createCtx({
            _id: "settings-id",
            userId: "user-1",
            customModels: {},
            customThemes: ["https://tweakcn.com/themes/one", "https://tweakcn.com/themes/two"]
        })

        await deleteUserThemeHandler.handler(ctx, {
            url: "https://tweakcn.com/themes/one"
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "settings-id",
            expect.objectContaining({
                customThemes: ["https://tweakcn.com/themes/two"]
            })
        )
    })
})
