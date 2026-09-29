import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchMock, registryModels } = vi.hoisted(() => ({
    fetchMock: vi.fn(),
    registryModels: [] as Array<{ adapters: string[]; preferredOpenRouterProviders?: string[] }>
}))

vi.mock("../../convex/lib/models", () => ({
    MODELS_SHARED: registryModels,
    isChatModel: () => true,
    getOpenRouterProviderModelId: (model: { adapters: string[] }) =>
        model.adapters[0]?.slice("openrouter:".length)
}))

vi.mock("convex/values", () => ({
    v: new Proxy(
        {},
        {
            get: () => () => ({})
        }
    )
}))

vi.mock("../../convex/_generated/server", () => ({
    internalAction: (config: unknown) => config,
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    query: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        model_provider_metadata: {
            upsertOpenRouterModelMetadataInternal: "upsertOpenRouterModelMetadataInternal",
            markRemovedOpenRouterModelsInternal: "markRemovedOpenRouterModelsInternal"
        }
    }
}))

import { ANTHROPIC_MODELS } from "../../convex/lib/models/anthropic"
import { OPENAI_MODELS } from "../../convex/lib/models/openai"
import { XAI_MODELS } from "../../convex/lib/models/xai"
import {
    markRemovedOpenRouterModelsInternal,
    upsertOpenRouterModelMetadataInternal
} from "../../convex/model_provider_metadata"
import { syncOpenRouterModelMetadata } from "../../convex/model_provider_metadata_node"

const syncOpenRouterModelMetadataHandler = syncOpenRouterModelMetadata as unknown as {
    handler: (ctx: any) => Promise<any>
}
const markRemovedOpenRouterModelsInternalHandler =
    markRemovedOpenRouterModelsInternal as unknown as {
        handler: (ctx: any, args: any) => Promise<any>
    }
const upsertOpenRouterModelMetadataInternalHandler =
    upsertOpenRouterModelMetadataInternal as unknown as {
        handler: (ctx: any, args: any) => Promise<any>
    }

describe("model_provider_metadata", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock)
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
        registryModels.length = 0
    })

    it("normalizes OpenRouter model metadata into per-million-token pricing", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: "openai/gpt-test",
                        context_length: 128000,
                        knowledge_cutoff: "2025-06-30",
                        pricing: {
                            prompt: "0.00000125",
                            completion: "0.0000004"
                        },
                        top_provider: {
                            max_completion_tokens: 8192
                        }
                    },
                    {
                        id: "",
                        context_length: 123
                    }
                ]
            })
        })

        const ctx = {
            runMutation: vi.fn().mockResolvedValue({ upserted: 1 })
        }

        await syncOpenRouterModelMetadataHandler.handler(ctx)

        expect(ctx.runMutation).toHaveBeenCalledWith("upsertOpenRouterModelMetadataInternal", {
            models: [
                expect.objectContaining({
                    provider: "openrouter",
                    providerModelId: "openai/gpt-test",
                    contextLength: 128000,
                    maxCompletionTokens: 8192,
                    knowledgeCutoff: "2025-06-30",
                    inputUsdPer1MTokens: 1.25,
                    outputUsdPer1MTokens: 0.4,
                    source: "openrouter"
                })
            ]
        })
    })

    it("captures catalog names, modalities, and supported parameters", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: "vendor/model",
                        name: "Vendor: Model",
                        architecture: {
                            input_modalities: ["text", "image", 42],
                            output_modalities: ["text"]
                        },
                        supported_parameters: ["tools", "reasoning"]
                    }
                ]
            })
        })
        const ctx = { runMutation: vi.fn().mockResolvedValue({ upserted: 1 }) }

        await syncOpenRouterModelMetadataHandler.handler(ctx)

        expect(ctx.runMutation.mock.calls[0][1].models[0]).toMatchObject({
            name: "Vendor: Model",
            inputModalities: ["text", "image"],
            outputModalities: ["text"],
            supportedParameters: ["tools", "reasoning"]
        })
    })

    it("records aliases, removal dates, and provider counts for chat models", async () => {
        const chat = { input_modalities: ["text"], output_modalities: ["text"] }
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith("/models")) {
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            { id: "vendor/served", architecture: chat },
                            {
                                id: "~vendor/latest",
                                architecture: chat,
                                alias_target: { slug: "vendor/served" },
                                expiration_date: "2026-10-20"
                            },
                            { id: "vendor/unreachable", architecture: chat }
                        ]
                    })
                }
            }
            if (url.includes("vendor/served")) {
                return { ok: true, json: async () => ({ data: { endpoints: [{}, {}] } }) }
            }
            if (url.includes("unreachable")) return { ok: false, status: 503 }
            return { ok: true, json: async () => ({ data: { endpoints: [] } }) }
        })
        const ctx = { runMutation: vi.fn().mockResolvedValue({ upserted: 3 }) }

        await syncOpenRouterModelMetadataHandler.handler(ctx)

        type SyncedRow = { providerModelId: string; providerCount?: number }
        const byId: Record<string, SyncedRow> = Object.fromEntries(
            ctx.runMutation.mock.calls
                .filter((call) => call[0] === "upsertOpenRouterModelMetadataInternal")
                .flatMap((call) => call[1].models as SyncedRow[])
                .map((model) => [model.providerModelId, model])
        )
        expect(byId["vendor/served"].providerCount).toBe(2)
        expect(byId["~vendor/latest"]).toMatchObject({
            aliasOf: "vendor/served",
            expirationDate: "2026-10-20",
            providerCount: 0
        })
        // A failed fetch isn't a zero; the stored count is kept instead.
        expect(byId["vendor/unreachable"].providerCount).toBeUndefined()
    })

    it("ignores missing and malformed OpenRouter knowledge cutoffs", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [
                    { id: "openai/no-cutoff", knowledge_cutoff: null },
                    { id: "openai/bad-cutoff", knowledge_cutoff: "summer 2025" }
                ]
            })
        })
        const ctx = {
            runMutation: vi.fn().mockResolvedValue({ upserted: 2 })
        }

        await syncOpenRouterModelMetadataHandler.handler(ctx)

        const models = ctx.runMutation.mock.calls[0][1].models
        expect(models).toHaveLength(2)
        expect(models.every((model: { knowledgeCutoff?: string }) => !model.knowledgeCutoff)).toBe(
            true
        )
    })

    it("syncs separate routing summaries with curated preferences", async () => {
        registryModels.push({
            adapters: ["openrouter:deepseek/deepseek-v4-pro-0813"],
            preferredOpenRouterProviders: ["deepseek"]
        })
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: "deepseek/deepseek-v4-pro-0813",
                            pricing: {
                                prompt: "0.0000001",
                                completion: "0.0000002"
                            }
                        }
                    ]
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [] })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        endpoints: [
                            {
                                tag: "deepseek/fp8",
                                pricing: {
                                    prompt: "0.00000066",
                                    completion: "0.00000198"
                                }
                            }
                        ]
                    }
                })
            })

        const ctx = {
            runMutation: vi.fn().mockResolvedValue({ upserted: 1 })
        }

        await syncOpenRouterModelMetadataHandler.handler(ctx)

        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "https://openrouter.ai/api/v1/models/deepseek/deepseek-v4-pro-0813/endpoints",
            expect.any(Object)
        )
        expect(ctx.runMutation.mock.calls[0][1].models[0]).toMatchObject({
            routing: {
                silkchat: {
                    available: true,
                    pricing: { inputUsdPer1MTokens: 0.66, outputUsdPer1MTokens: 1.98 }
                },
                zdr: { available: false },
                floor: { available: true }
            }
        })
        expect(
            Object.values(ctx.runMutation.mock.calls[0][1].models[0].routing).every(
                (summary) => !("endpoints" in (summary as object))
            )
        ).toBe(true)
    })

    it("does not turn a failed endpoint refresh into an empty provider pool", async () => {
        registryModels.push({ adapters: ["openrouter:vendor/model"] })
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [{ id: "vendor/model" }] })
            })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
            .mockResolvedValueOnce({ ok: false, status: 503 })
        const ctx = { runMutation: vi.fn().mockResolvedValue({ upserted: 1 }) }
        await syncOpenRouterModelMetadataHandler.handler(ctx)
        expect(ctx.runMutation.mock.calls[0][1].models[0].routing).toBeUndefined()
    })

    it("marks removed models unavailable after an endpoint 404", async () => {
        registryModels.push({ adapters: ["openrouter:vendor/removed"] })
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
            .mockResolvedValueOnce({ ok: false, status: 404 })
        const ctx = { runMutation: vi.fn().mockResolvedValue({ upserted: 1 }) }
        await syncOpenRouterModelMetadataHandler.handler(ctx)
        expect(ctx.runMutation.mock.calls[0][1].models[0].routing.zdr.available).toBe(false)
    })

    it("uses canonical OpenRouter slugs for versioned Anthropic and xAI models", () => {
        expect(
            ANTHROPIC_MODELS.find((model) => model.id === "claude-opus-4.8")?.adapters
        ).toContain("openrouter:anthropic/claude-opus-4.8")
        expect(
            ANTHROPIC_MODELS.find((model) => model.id === "claude-haiku-4.5")?.adapters
        ).toContain("openrouter:anthropic/claude-haiku-4.5")
        expect(XAI_MODELS.find((model) => model.id === "grok-4.20-0309")?.adapters).toContain(
            "openrouter:x-ai/grok-4.20"
        )
        expect(OPENAI_MODELS.find((model) => model.id === "gpt-5.3")?.adapters).toContain(
            "openrouter:openai/gpt-5.3-chat"
        )
    })

    it("replaces existing metadata rows and inserts new ones", async () => {
        const existing = {
            _id: "row-1",
            provider: "openrouter",
            providerModelId: "openai/existing"
        }
        const first = vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(null)
        const ctx = {
            db: {
                query: vi.fn(() => ({
                    withIndex: vi.fn((_indexName, buildFilter) => {
                        const query = {
                            eq: vi.fn(() => query)
                        }
                        buildFilter(query)
                        return { first }
                    })
                })),
                replace: vi.fn(),
                insert: vi.fn()
            }
        }

        const models = [
            {
                provider: "openrouter",
                providerModelId: "openai/existing",
                contextLength: 1000,
                fetchedAt: 1,
                source: "openrouter"
            },
            {
                provider: "openrouter",
                providerModelId: "openai/new",
                contextLength: 2000,
                fetchedAt: 1,
                source: "openrouter"
            }
        ]

        await upsertOpenRouterModelMetadataInternalHandler.handler(ctx, { models })

        expect(ctx.db.replace).toHaveBeenCalledWith("row-1", models[0])
        expect(ctx.db.insert).toHaveBeenCalledWith("modelProviderMetadata", models[1])
    })

    it("marks models missing from the latest catalog as removed", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [{ id: "vendor/present" }] })
        })
        const ctx = { runMutation: vi.fn().mockResolvedValue({ upserted: 1 }) }

        await syncOpenRouterModelMetadataHandler.handler(ctx)

        expect(ctx.runMutation).toHaveBeenLastCalledWith(
            "markRemovedOpenRouterModelsInternal",
            expect.objectContaining({ presentModelIds: ["vendor/present"] })
        )

        const rows = [
            { _id: "present", providerModelId: "vendor/present" },
            { _id: "gone", providerModelId: "vendor/gone" },
            { _id: "already", providerModelId: "vendor/already", removedAt: 1 }
        ]
        const patch = vi.fn()
        const markCtx = {
            db: {
                query: vi.fn(() => ({
                    withIndex: vi.fn(() => ({ collect: vi.fn().mockResolvedValue(rows) }))
                })),
                patch
            }
        }

        await markRemovedOpenRouterModelsInternalHandler.handler(markCtx, {
            presentModelIds: ["vendor/present"],
            removedAt: 5
        })

        expect(patch.mock.calls).toEqual([["gone", { removedAt: 5 }]])
    })

    it("keeps the last provider count when a sync couldn't fetch one", async () => {
        const existing = {
            _id: "row-1",
            provider: "openrouter",
            providerModelId: "vendor/model",
            providerCount: 4
        }
        const ctx = {
            db: {
                query: vi.fn(() => ({
                    withIndex: vi.fn(() => ({ first: vi.fn().mockResolvedValue(existing) }))
                })),
                replace: vi.fn(),
                insert: vi.fn()
            }
        }

        await upsertOpenRouterModelMetadataInternalHandler.handler(ctx, {
            models: [
                {
                    provider: "openrouter",
                    providerModelId: "vendor/model",
                    fetchedAt: 2,
                    source: "openrouter"
                }
            ]
        })

        expect(ctx.db.replace.mock.calls[0][1].providerCount).toBe(4)
    })

    it("preserves the last successful mode snapshot when only other modes refresh", async () => {
        const zdr = {
            available: true,
            fetchedAt: 1,
            pricing: { inputUsdPer1MTokens: 2, outputUsdPer1MTokens: 4 },
            endpoints: [{ tag: "legacy", providerName: "Legacy", pricing: {} }]
        }
        const existing = { _id: "row-1", routing: { zdr } }
        const ctx = {
            db: {
                query: () => ({ withIndex: () => ({ first: async () => existing }) }),
                replace: vi.fn(),
                insert: vi.fn()
            }
        }
        const next = {
            provider: "openrouter",
            providerModelId: "vendor/model",
            fetchedAt: 2,
            source: "openrouter",
            routing: { floor: { available: false, fetchedAt: 2 } }
        }
        await upsertOpenRouterModelMetadataInternalHandler.handler(ctx, { models: [next] })
        expect(ctx.db.replace.mock.calls[0][1].routing).toEqual({
            zdr: {
                available: true,
                fetchedAt: 1,
                pricing: { inputUsdPer1MTokens: 2, outputUsdPer1MTokens: 4 }
            },
            floor: next.routing.floor
        })
    })
})
