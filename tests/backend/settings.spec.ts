import { beforeEach, describe, expect, it, vi } from "vitest"

const { decryptKeyMock, encryptKeyMock, getUserIdentityMock, isInternalProviderConfiguredMock } =
    vi.hoisted(() => ({
        decryptKeyMock: vi.fn(),
        encryptKeyMock: vi.fn(),
        getUserIdentityMock: vi.fn(),
        isInternalProviderConfiguredMock: vi.fn()
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
        titleGenerationModel: "gemini-3.1-flash-lite-preview",
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

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/lib/internal_provider_config", () => ({
    isInternalProviderConfigured: isInternalProviderConfiguredMock
}))

vi.mock("../../convex/lib/models", () => ({
    MODELS_SHARED: [
        {
            id: "shared-text",
            name: "Shared Text",
            abilities: ["reasoning"],
            mode: "text",
            adapters: ["i3-openai:shared-text", "openrouter:or-shared", "openai:shared-text"],
            maxPerMessage: 4,
            supportsReferenceImages: true,
            openrouterImageModalities: undefined,
            supportedImageSizes: ["1:1"],
            supportedImageResolutions: ["1K"],
            prototypeCreditTier: "basic",
            prototypeCreditTierWithReasoning: "pro"
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
    NonSensitiveUserSettings: {},
    StoredModelAbilitySchema: {}
}))

import { ChatError } from "@/lib/errors"
import {
    getSearchProviderAvailability,
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
const getSearchProviderAvailabilityHandler = getSearchProviderAvailability as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const updateUserSettingsHandler = updateUserSettings as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}
const updateUserSettingsPartialHandler = updateUserSettingsPartial as unknown as {
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
                            tableName === "userAccess" ? (options.userAccess ?? null) : settings
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
        isInternalProviderConfiguredMock.mockReset().mockReturnValue(false)
        Reflect.deleteProperty(process.env, "OPENROUTER_API_KEY")
        Reflect.deleteProperty(process.env, "FIRECRAWL_API_KEY")
        Reflect.deleteProperty(process.env, "BRAVE_API_KEY")
        Reflect.deleteProperty(process.env, "TAVILY_API_KEY")
        Reflect.deleteProperty(process.env, "SERPER_API_KEY")
    })

    it("builds a registry with enabled BYOK providers, internal providers, and custom models", async () => {
        process.env.OPENROUTER_API_KEY = "or-key"
        isInternalProviderConfiguredMock.mockImplementation((providerId: string) => {
            return providerId === "openai"
        })

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
                authMode: "ai-studio"
            },
            gateway: {
                key: "dec:gateway-key",
                name: "gateway",
                authMode: undefined
            },
            customprov: {
                key: "dec:custom-key",
                endpoint: "https://custom.example.com/v1",
                name: "Custom Provider"
            }
        })
        expect(result.models["shared-text"].adapters).toEqual([
            "i3-openai:shared-text",
            "openrouter:or-shared",
            "openai:shared-text"
        ])
        expect(result.models["admin-text"]).toBeUndefined()
        expect(result.models["custom-model"]).toMatchObject({
            id: "custom-model-id",
            name: "Custom Model",
            adapters: ["customprov:custom-model-id"],
            customProviderId: "customprov"
        })
    })

    it("includes admin-only shared models in the registry for staff users", async () => {
        isInternalProviderConfiguredMock.mockImplementation((providerId: string) => {
            return providerId === "openai"
        })

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
            adapters: ["i3-openai:admin-text"]
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

    it("reports search provider availability without exposing deployment keys", async () => {
        process.env.BRAVE_API_KEY = "deployment-brave-key"

        const result = await getSearchProviderAvailabilityHandler.handler(
            createCtx({
                userId: "user-1",
                searchProvider: "firecrawl",
                generalProviders: {
                    firecrawl: {
                        enabled: true,
                        encryptedKey: "encrypted-firecrawl-key"
                    },
                    tavily: {
                        enabled: false,
                        encryptedKey: "encrypted-tavily-key"
                    },
                    brave: undefined,
                    serper: undefined,
                    supermemory: undefined
                }
            }),
            {}
        )

        expect(result).toMatchObject({
            firecrawl: {
                available: true,
                byok: true,
                deployment: false
            },
            brave: {
                available: true,
                byok: false,
                deployment: true
            },
            tavily: {
                available: false,
                byok: false,
                deployment: false
            },
            serper: {
                available: false,
                byok: false,
                deployment: false
            }
        })
        expect(JSON.stringify(result)).not.toContain("deployment-brave-key")
        expect(JSON.stringify(result)).not.toContain("encrypted-firecrawl-key")
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
                brave: {
                    enabled: true,
                    country: "my",
                    searchLang: "ms",
                    safesearch: "strict"
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
                        authMode: "vertex",
                        encryptedKey: "existing-core-key"
                    }
                },
                customAIProviders: {
                    customprov: {
                        enabled: true,
                        endpoint: "https://custom.example.com/v1",
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
                        country: "my",
                        searchLang: "ms",
                        safesearch: "strict"
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
})
