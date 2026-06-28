import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchMock } = vi.hoisted(() => ({
    fetchMock: vi.fn()
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
    internalQuery: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        model_provider_metadata: {
            upsertOpenRouterModelMetadataInternal: "upsertOpenRouterModelMetadataInternal"
        }
    }
}))

import { upsertOpenRouterModelMetadataInternal } from "../../convex/model_provider_metadata"
import { syncOpenRouterModelMetadata } from "../../convex/model_provider_metadata_node"

const syncOpenRouterModelMetadataHandler = syncOpenRouterModelMetadata as unknown as {
    handler: (ctx: any) => Promise<any>
}
const upsertOpenRouterModelMetadataInternalHandler =
    upsertOpenRouterModelMetadataInternal as unknown as {
        handler: (ctx: any, args: any) => Promise<any>
    }

describe("model_provider_metadata", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock)
        fetchMock.mockReset()
    })

    it("normalizes OpenRouter model metadata into per-million-token pricing", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: "openai/gpt-test",
                        context_length: 128000,
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
                    inputUsdPer1MTokens: 1.25,
                    outputUsdPer1MTokens: 0.4,
                    source: "openrouter"
                })
            ]
        })
    })

    it("upserts existing metadata rows and inserts new ones", async () => {
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
                patch: vi.fn(),
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

        expect(ctx.db.patch).toHaveBeenCalledWith("row-1", models[0])
        expect(ctx.db.insert).toHaveBeenCalledWith("modelProviderMetadata", models[1])
    })
})
