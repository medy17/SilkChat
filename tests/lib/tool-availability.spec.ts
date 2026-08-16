import { beforeEach, describe, expect, it } from "vitest"

import {
    enforceToolIdentityPolicy,
    resolveToolAvailability
} from "../../convex/lib/tools/availability"

const createSettings = (overrides: Record<string, unknown> = {}) =>
    ({
        userId: "user-1",
        customModels: {},
        titleGenerationModel: "model",
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
        Reflect.deleteProperty(process.env, "VERCEL_TEAM_ID")
        Reflect.deleteProperty(process.env, "VERCEL_PROJECT_ID")
        Reflect.deleteProperty(process.env, "VERCEL_TOKEN")
        Reflect.deleteProperty(process.env, "SUPERMEMORY_API_KEY")
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

    it("enables code execution only with complete deployment credentials", () => {
        process.env.VERCEL_TEAM_ID = "team-1"
        process.env.VERCEL_PROJECT_ID = "project-1"

        expect(resolveToolAvailability(createSettings()).code_execution).toEqual({
            enabled: false,
            fundingSource: "none"
        })

        process.env.VERCEL_TOKEN = "token-1"

        expect(resolveToolAvailability(createSettings()).code_execution).toEqual({
            enabled: true,
            fundingSource: "deployment"
        })
    })

    it("enables memory only when Supermemory is deployment-configured", () => {
        process.env.PERPLEXITY_API_KEY = "deployment-perplexity-key"
        process.env.SUPERMEMORY_API_KEY = "deployment-supermemory-key"

        const result = resolveToolAvailability(createSettings())

        expect(result.web_search.fundingSource).toBe("deployment")
        expect(result.supermemory).toEqual({
            enabled: true,
            fundingSource: "deployment"
        })
        expect(result.mathematical_instruments).toEqual({
            enabled: true,
            fundingSource: "none"
        })
    })

    it("withholds sandbox-backed tools from anonymous sessions", () => {
        const tools = [
            "web_search",
            "code_execution",
            "mathematical_instruments",
            "supermemory"
        ] as const

        expect(enforceToolIdentityPolicy([...tools], { isAnonymous: true })).toEqual(["web_search"])
        expect(enforceToolIdentityPolicy([...tools], { isAnonymous: false })).toEqual(tools)
    })
})
