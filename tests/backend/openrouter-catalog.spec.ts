import { describe, expect, it } from "vitest"
import {
    NO_PROVIDERS_MODEL_REASON,
    RETIRED_MODEL_REASON,
    getCustomModelCatalogStatus,
    toOpenRouterCatalogEntries,
    toPlainModelDescription
} from "../../convex/lib/openrouter_catalog"

const textModel = { inputModalities: ["text"], outputModalities: ["text"] }

describe("toOpenRouterCatalogEntries", () => {
    it("keeps only text-in, text-only-out models", () => {
        const entries = toOpenRouterCatalogEntries([
            { providerModelId: "vendor/chat", ...textModel },
            {
                providerModelId: "vendor/image-and-text",
                inputModalities: ["text"],
                outputModalities: ["image", "text"]
            },
            {
                providerModelId: "vendor/audio-out",
                inputModalities: ["text"],
                outputModalities: ["text", "audio"]
            },
            { providerModelId: "vendor/unknown" }
        ])

        expect(entries.map((entry) => entry.id)).toEqual(["vendor/chat"])
    })

    it("leaves out aliases, batch variants, and unserved models, but keeps ones scheduled for removal", () => {
        const entries = toOpenRouterCatalogEntries([
            { providerModelId: "vendor/stable", providerCount: 3, ...textModel },
            { providerModelId: "vendor/not-yet-counted", ...textModel },
            { providerModelId: "~vendor/latest", aliasOf: "vendor/stable", ...textModel },
            { providerModelId: "vendor/sunsetting", expirationDate: "2026-10-20", ...textModel },
            { providerModelId: "vendor/abandoned", providerCount: 0, ...textModel },
            { providerModelId: "vendor/stable:batch", providerCount: 1, ...textModel }
        ])

        expect(entries.map((entry) => entry.id)).toEqual([
            "vendor/not-yet-counted",
            "vendor/stable",
            "vendor/sunsetting"
        ])
    })

    it("leaves out models OpenRouter has dropped from its catalog", () => {
        const entries = toOpenRouterCatalogEntries([
            { providerModelId: "vendor/current", ...textModel },
            { providerModelId: "vendor/dropped", removedAt: 1, ...textModel }
        ])

        expect(entries.map((entry) => entry.id)).toEqual(["vendor/current"])
    })

    it("derives prefill abilities from input modalities and supported parameters", () => {
        const [entry] = toOpenRouterCatalogEntries([
            {
                providerModelId: "vendor/model",
                inputModalities: ["text", "image", "file"],
                outputModalities: ["text"],
                supportedParameters: ["tools", "reasoning", "temperature"]
            }
        ])

        expect(entry).toMatchObject({
            supportsImages: true,
            supportsFiles: true,
            supportsTools: true,
            supportsReasoning: true
        })
    })

    it("imports reasoning levels in the app's order, with none as off", () => {
        const [entry] = toOpenRouterCatalogEntries([
            {
                providerModelId: "vendor/model",
                ...textModel,
                reasoning: {
                    mandatory: false,
                    supportedEfforts: ["max", "high", "none", "ultra", "low"],
                    defaultEffort: "max"
                }
            }
        ])

        expect(entry.reasoningEfforts).toEqual(["off", "low", "high", "max"])
        expect(entry.defaultReasoningEffort).toBe("max")
    })

    it("marks mandatory reasoning without levels as always on", () => {
        const [entry] = toOpenRouterCatalogEntries([
            { providerModelId: "vendor/model", ...textModel, reasoning: { mandatory: true } }
        ])

        expect(entry).toMatchObject({ supportsReasoning: true, reasoningEfforts: [] })
    })

    it("falls back to the model ID for the name and sorts by name", () => {
        const entries = toOpenRouterCatalogEntries([
            { providerModelId: "vendor/zeta", name: "Zeta", ...textModel },
            { providerModelId: "vendor/alpha", ...textModel }
        ])

        expect(entries.map((entry) => entry.name)).toEqual(["vendor/alpha", "Zeta"])
    })
})

describe("getCustomModelCatalogStatus", () => {
    it("greys out retired and unserved models, but not aliases or unseen models", () => {
        expect(getCustomModelCatalogStatus({ providerModelId: "a", removedAt: 1 })).toEqual({
            unavailableReason: RETIRED_MODEL_REASON
        })
        expect(getCustomModelCatalogStatus({ providerModelId: "b", providerCount: 0 })).toEqual({
            unavailableReason: NO_PROVIDERS_MODEL_REASON
        })
        expect(
            getCustomModelCatalogStatus({ providerModelId: "~c", providerCount: 0, aliasOf: "c" })
        ).toBeUndefined()
        expect(getCustomModelCatalogStatus(undefined)).toBeUndefined()
    })

    it("passes through the removal date for models still served", () => {
        expect(
            getCustomModelCatalogStatus({
                providerModelId: "d",
                providerCount: 2,
                expirationDate: "2026-10-20"
            })
        ).toEqual({ expirationDate: "2026-10-20" })
    })
})

describe("toPlainModelDescription", () => {
    it("keeps complete sentences from OpenRouter's truncated preview as plain text", () => {
        expect(
            toPlainModelDescription(
                "GLM-5.3 is from [Z.ai](/z-ai), built for **agents** and `tools`. It supports..."
            )
        ).toBe("GLM-5.3 is from Z.ai, built for agents and tools.")
    })

    it("keeps identifiers intact and marks a cut-off first sentence with an ellipsis", () => {
        expect(toPlainModelDescription("Uses reasoning_effort set to high.")).toBe(
            "Uses reasoning_effort set to high."
        )
        expect(toPlainModelDescription("A very long opening sentence that never ends...")).toBe(
            "A very long opening sentence that never ends…"
        )
    })
})
