import { describe, expect, it } from "vitest"
import {
    buildCapabilityContext,
    buildPrompt,
    buildToolBudgetContext
} from "../../convex/chat_http/prompt"

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

    it("keeps the per-turn tool budget out of the stable prompt", () => {
        const prompt = buildPrompt({
            enabledTools: ["web_search", "supermemory"]
        })

        expect(prompt).not.toContain("## Tool Budget")
    })

    it("builds the effective per-turn tool budget for the changing prompt suffix", () => {
        const context = buildToolBudgetContext(5)

        expect(context).toContain("## Tool Budget")
        expect(context).toContain("This turn has 5 allocated tool calls maximum.")
        expect(buildToolBudgetContext()).toBe("")
    })

    it("describes the ephemeral network-enabled code execution contract", () => {
        const prompt = buildPrompt({
            enabledTools: ["code_execution"]
        })

        expect(prompt).toContain("## Code Execution Tool")
        expect(prompt).toContain("Node.js 24")
        expect(prompt).toContain("Python 3.13")
        expect(prompt).toContain("No third-party library is guaranteed")
        expect(prompt).toContain("Give every execute_code call a concise, user-facing purpose")
        expect(prompt).toContain("Request(url, headers=requestHeaders)")
        expect(prompt).toContain("excerpts of at most 1,000 characters each")
        expect(prompt).toContain("public internet access")
        expect(prompt).toContain("filesystem is discarded after each call")
        expect(prompt).toContain("call release_persistent_sandbox")
        expect(prompt).toContain("suspend automatically")
        expect(prompt).toContain("receives no SilkChat or provider credentials")
    })

    it("explains whether a missing capability can be enabled by the user", () => {
        const context = buildCapabilityContext({
            requestedTools: [],
            enabledTools: [],
            toolAvailability: {
                web_search: { enabled: true, fundingSource: "deployment" },
                code_execution: { enabled: true, fundingSource: "deployment" },
                supermemory: { enabled: false, fundingSource: "none" },
                mcp: { enabled: false, fundingSource: "none" }
            },
            modelAbilities: ["function_calling", "vision"],
            isAnonymous: false
        })

        expect(context).toContain("Code execution: not enabled by the user")
        expect(context).toContain("ask them to enable it in Tools")
        expect(context).toContain(
            "Memory: unavailable because the user has no enabled Supermemory BYOK key"
        )
        expect(context).toContain("you cannot use or request memory now")
    })

    it("does not advertise callable tools to a model without function calling", () => {
        const context = buildCapabilityContext({
            requestedTools: ["code_execution"],
            enabledTools: [],
            toolAvailability: {
                web_search: { enabled: true, fundingSource: "deployment" },
                code_execution: { enabled: true, fundingSource: "deployment" },
                supermemory: { enabled: true, fundingSource: "byok" },
                mcp: { enabled: true, fundingSource: "byok" }
            },
            modelAbilities: [],
            isAnonymous: false
        })

        expect(context).toContain(
            "Tool calling: unavailable because the selected model does not support it"
        )
        expect(context).not.toContain("Code execution:")
        expect(context).not.toContain("Memory:")
        expect(context).toContain("Vision and image tools: unavailable")
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
