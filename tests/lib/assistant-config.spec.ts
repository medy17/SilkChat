import type { SharedModel } from "@/convex/lib/models"
import {
    getLatestAssistantConfig,
    getRetryTargetAssistantConfig,
    resolveAssistantConfigOverride
} from "@/lib/assistant-config"
import { describe, expect, it } from "vitest"

const createModel = (overrides: Partial<SharedModel>): SharedModel =>
    ({
        id: "test-model",
        name: "Test Model",
        adapters: ["openrouter:vendor/model"],
        abilities: [],
        ...overrides
    }) as SharedModel

describe("assistant-config", () => {
    it("uses the assistant reply metadata for retry same", () => {
        const config = getRetryTargetAssistantConfig(
            [
                { id: "u1", role: "user" },
                {
                    id: "a1",
                    role: "assistant",
                    metadata: {
                        modelId: "claude-opus-4.6",
                        reasoningEffort: "high"
                    }
                },
                { id: "u2", role: "user" }
            ],
            "u1"
        )

        expect(config).toEqual({
            modelId: "claude-opus-4.6",
            reasoningEffort: "high"
        })
    })

    it("hydrates from the latest assistant metadata in a revisited thread", () => {
        const config = getLatestAssistantConfig([
            {
                id: "a1",
                role: "assistant",
                metadata: {
                    modelId: "gpt-5.4",
                    reasoningEffort: "medium"
                }
            },
            { id: "u2", role: "user" },
            {
                id: "a2",
                role: "assistant",
                metadata: {
                    modelId: "gemini-3.5-flash",
                    reasoningEffort: "minimal"
                }
            }
        ])

        expect(config).toEqual({
            modelId: "gemini-3.5-flash",
            reasoningEffort: "minimal"
        })
    })

    it("resolves sunset models through the replacement chain before retrying", () => {
        const oldModel = createModel({
            id: "old-model",
            abilities: ["reasoning", "effort_control"],
            sunsetOn: "2026-01-01",
            replacementId: "new-model"
        })
        const newModel = createModel({
            id: "new-model",
            abilities: ["reasoning", "effort_control"],
            reasoningEfforts: ["minimal", "low", "medium", "high"],
            defaultReasoningEffort: "minimal"
        })

        const resolved = resolveAssistantConfigOverride({
            config: {
                modelId: "old-model",
                reasoningEffort: "off"
            },
            sharedModels: [oldModel, newModel],
            availableModels: [{ id: "new-model" }],
            fallbackModelId: "new-model"
        })

        expect(resolved).toEqual({
            modelIdOverride: "new-model",
            reasoningEffortOverride: "minimal"
        })
    })
})
