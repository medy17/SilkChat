import { describe, expect, it } from "vitest"
import {
    buildCapabilityContext,
    buildImageReferenceContext,
    buildPrompt,
    buildToolBudgetContext
} from "../../convex/chat_http/prompt"
import { formatImageModelCapabilitySummary } from "../../convex/lib/image_generation/shared"
import type { SharedModel } from "../../convex/lib/models"

describe("buildPrompt", () => {
    it("aligns math delimiter guidance with Streamdown defaults", () => {
        const prompt = buildPrompt({
            enabledTools: []
        })

        expect(prompt).toContain("Inline math: Use double-dollar delimiters like $$L_{0}$$.")
        expect(prompt).toContain("Single-dollar delimiters ($L_{0}$) are forbidden.")
    })

    it("advertises native visualizations and computation only with Math Kit enabled", () => {
        const enabledPrompt = buildPrompt({
            enabledTools: ["mathematical_instruments"]
        })
        const disabledPrompt = buildPrompt({ enabledTools: [] })

        expect(enabledPrompt).toContain("`render_chart`: renders supplied numeric data")
        expect(enabledPrompt).toContain(
            "Math Kit is the name the user sees in the Tools menu for the internal `mathematical_instruments` ability"
        )
        expect(enabledPrompt).toContain("`render_network`")
        expect(enabledPrompt).toContain("`execute_math`")
        expect(enabledPrompt).toContain(
            "It does not depend on the separate Code Execution toggle being on"
        )
        expect(enabledPrompt).toContain("the callable tool list is authoritative")
        expect(enabledPrompt).toContain("Use `execute_code` instead only for general-purpose")
        expect(enabledPrompt).toContain("Do not call both executors for the same calculation")
        expect(enabledPrompt).toContain("Do not use Canvas")
        expect(disabledPrompt).toContain(
            "Math Kit (internal ability: `mathematical_instruments`) is unavailable"
        )
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
                mathematical_instruments: { enabled: true, fundingSource: "none" },
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
                mathematical_instruments: { enabled: true, fundingSource: "none" },
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
                availableImageSelectionSummary: "- some-model (Some Model)"
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
                availableImageSelectionSummary: "- some-model (Some Model)"
            }
        })

        expect(prompt).toContain("the user's saved defaults (resolution 1K, variants 1)")
    })

    it("keeps turn-scoped image references out of the stable prompt", () => {
        const prompt = buildPrompt({
            enabledTools: [],
            imageGenerationTool: {
                enabled: true,
                availableImageSelectionSummary: "- some-model (Some Model)"
            }
        })
        const context = buildImageReferenceContext([
            "image_ref_1: SilkScreen generation from assistant message 1"
        ])

        expect(prompt).not.toContain("Available Image Reference IDs")
        expect(context).toContain("## Available Image Reference IDs")
        expect(context).toContain("- image_ref_1: SilkScreen generation from assistant message 1")
        expect(buildImageReferenceContext([])).toContain("- None")
    })

    it("groups image models by aspect ratios while retaining names and explicit limits", () => {
        const models = [
            {
                id: "model-a",
                name: "Model A",
                mode: "image",
                adapters: [],
                abilities: [],
                supportedImageSizes: ["1:1", "16:9"],
                supportedImageResolutions: ["1K", "2K"],
                supportsReferenceImages: true,
                maxReferenceImages: 3,
                maxPerMessage: 4
            },
            {
                id: "model-b",
                name: "Model B",
                mode: "image",
                adapters: [],
                abilities: [],
                supportedImageSizes: ["1:1", "16:9"],
                supportsReferenceImages: false,
                maxPerMessage: 2
            }
        ] satisfies SharedModel[]

        const summary = formatImageModelCapabilitySummary(models)

        expect(summary.match(/Aspect ratios:/g)).toHaveLength(1)
        expect(summary).toContain("- model-a (Model A) — res: 1K|2K; refs: max 3; variants: max 4")
        expect(summary).toContain(
            "- model-b (Model B) — res: default only; refs: none; variants: max 2"
        )
    })
})
