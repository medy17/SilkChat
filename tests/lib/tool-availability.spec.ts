import { beforeEach, describe, expect, it } from "vitest"

import { resolveToolAvailability } from "../../convex/lib/tools/availability"

const createSettings = (overrides: Record<string, unknown> = {}) =>
    ({
        userId: "user-1",
        customModels: {},
        titleGenerationModel: "model",
        mcpServers: [],
        coreAIProviders: {},
        customAIProviders: {},
        generalProviders: {
            supermemory: undefined
        },
        ...overrides
    }) as never

describe("tool availability", () => {
    beforeEach(() => {
        Reflect.deleteProperty(process.env, "PERPLEXITY_API_KEY")
    })

    it("enables web search only when Perplexity is deployment-configured", () => {
        expect(resolveToolAvailability(createSettings()).web_search).toEqual({
            enabled: false,
            fundingSource: "none"
        })

        process.env.PERPLEXITY_API_KEY = "deployment-perplexity-key"

        expect(resolveToolAvailability(createSettings()).web_search).toEqual({
            enabled: true,
            fundingSource: "deployment"
        })
    })

    it("ignores retired search BYOK settings", () => {
        const result = resolveToolAvailability(
            createSettings({
                searchProvider: "firecrawl",
                generalProviders: {
                    firecrawl: {
                        enabled: true,
                        encryptedKey: "retired-key"
                    }
                }
            })
        )

        expect(result.web_search).toEqual({
            enabled: false,
            fundingSource: "none"
        })
    })

    it("keeps supermemory and mcp user-provisioned", () => {
        process.env.PERPLEXITY_API_KEY = "deployment-perplexity-key"

        const result = resolveToolAvailability(createSettings())

        expect(result.web_search.fundingSource).toBe("deployment")
        expect(result.supermemory).toEqual({
            enabled: false,
            fundingSource: "none"
        })
        expect(result.mcp).toEqual({
            enabled: false,
            fundingSource: "none"
        })
    })
})
