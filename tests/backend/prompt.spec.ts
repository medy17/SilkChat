import { describe, expect, it } from "vitest"
import { buildPrompt } from "../../convex/chat_http/prompt"

describe("buildPrompt", () => {
    it("aligns math delimiter guidance with Streamdown defaults", () => {
        const prompt = buildPrompt({
            enabledTools: []
        })

        expect(prompt).toContain("Inline math: Use double-dollar delimiters like $$L_{0}$$.")
        expect(prompt).toContain("Single-dollar delimiters ($L_{0}$) are forbidden.")
    })

    it("appends saved user customization when present", () => {
        const prompt = buildPrompt({
            enabledTools: [],
            userSettings: {
                userId: "user-1",
                searchProvider: "firecrawl",
                searchIncludeSourcesByDefault: false,
                coreAIProviders: {},
                customAIProviders: {},
                customModels: {},
                titleGenerationModel: "gemini-3.1-flash-lite",
                toolCallLimitPerTurn: 3,
                customThemes: [],
                mcpServers: [],
                generalProviders: {
                    supermemory: undefined,
                    firecrawl: undefined,
                    tavily: undefined,
                    brave: undefined,
                    serper: undefined
                },
                customization: {
                    name: "Ahmed",
                    aiPersonality: "Use paragraph replies.",
                    additionalContext: "I write TypeScript."
                },
                onboardingCompleted: false
            }
        })

        expect(prompt).toContain("## User Personalization")
        expect(prompt).toContain('- Address the user as "Ahmed"')
        expect(prompt).toContain("- Personality traits: Use paragraph replies.")
        expect(prompt).toContain("- Additional context about the user: I write TypeScript.")
    })

    it("includes the effective per-turn tool budget when tools are enabled", () => {
        const prompt = buildPrompt({
            enabledTools: ["web_search", "supermemory"],
            toolCallLimitPerTurn: 5
        })

        expect(prompt).toContain("## Tool Budget")
        expect(prompt).toContain("This turn has 5 allocated tool calls maximum.")
    })

    it("describes the ephemeral network-enabled code execution contract", () => {
        const prompt = buildPrompt({
            enabledTools: ["code_execution"]
        })

        expect(prompt).toContain("## Code Execution Tool")
        expect(prompt).toContain("Node.js 24")
        expect(prompt).toContain("Python 3.13")
        expect(prompt).toContain("No third-party library is guaranteed")
        expect(prompt).toContain("Request(url, headers=requestHeaders)")
        expect(prompt).toContain("excerpts of at most 1,000 characters each")
        expect(prompt).toContain("public internet access")
        expect(prompt).toContain("filesystem is discarded after each call")
        expect(prompt).toContain("call release_persistent_sandbox")
        expect(prompt).toContain("suspend automatically")
        expect(prompt).toContain("receives no SilkChat or provider credentials")
    })

    it("states the user's image defaults in the SilkScreen section", () => {
        const prompt = buildPrompt({
            enabledTools: [],
            userSettings: {
                userId: "user-1",
                searchProvider: "firecrawl",
                searchIncludeSourcesByDefault: false,
                coreAIProviders: {},
                customAIProviders: {},
                customModels: {},
                titleGenerationModel: "gemini-3.1-flash-lite",
                toolCallLimitPerTurn: 3,
                customThemes: [],
                mcpServers: [],
                imageGenerationDefaults: { resolution: "2K", variants: 2 },
                generalProviders: {
                    supermemory: undefined,
                    firecrawl: undefined,
                    tavily: undefined,
                    brave: undefined,
                    serper: undefined
                },
                onboardingCompleted: false
            },
            imageGenerationTool: {
                enabled: true,
                availableImageSelectionLabels: ["some-model (Some Model)"],
                availableReferenceLabels: []
            }
        })

        expect(prompt).toContain("## SilkScreen Image Preparation Tool")
        expect(prompt).toContain("the user's saved defaults (resolution 2K, variants 2)")
    })

    it("falls back to 1K / 1 variant in the SilkScreen section when no defaults are set", () => {
        const prompt = buildPrompt({
            enabledTools: [],
            imageGenerationTool: {
                enabled: true,
                availableImageSelectionLabels: ["some-model (Some Model)"],
                availableReferenceLabels: []
            }
        })

        expect(prompt).toContain("the user's saved defaults (resolution 1K, variants 1)")
    })
})
