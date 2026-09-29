import { describe, expect, it } from "vitest"
import { getCustomModelReasoningFields } from "../../convex/lib/models/reasoning"

const openRouterModel = { providerId: "openrouter", abilities: ["reasoning"] }

describe("getCustomModelReasoningFields", () => {
    it("exposes stored levels, including xhigh and max, for OpenRouter custom models", () => {
        expect(
            getCustomModelReasoningFields({
                ...openRouterModel,
                reasoningEfforts: ["max", "off", "low"],
                defaultReasoningEffort: "max"
            })
        ).toEqual({
            effortControl: true,
            reasoningEfforts: ["off", "low", "max"],
            supportsDisablingReasoning: true,
            defaultReasoningEffort: "max"
        })
    })

    it("treats off alone as an on/off toggle and no levels as always on", () => {
        expect(
            getCustomModelReasoningFields({ ...openRouterModel, reasoningEfforts: ["off"] })
        ).toEqual({ effortControl: false, supportsDisablingReasoning: true })
        expect(getCustomModelReasoningFields({ ...openRouterModel, reasoningEfforts: [] })).toEqual(
            { effortControl: false, supportsDisablingReasoning: false }
        )
    })

    it("ignores stored levels for other providers, models without reasoning, and legacy models", () => {
        const levels = { reasoningEfforts: ["low", "max"] as const }

        expect(
            getCustomModelReasoningFields({
                providerId: "custom-1",
                abilities: ["reasoning"],
                reasoningEfforts: [...levels.reasoningEfforts]
            })
        ).toEqual({ effortControl: false })
        expect(
            getCustomModelReasoningFields({
                providerId: "openrouter",
                abilities: [],
                reasoningEfforts: [...levels.reasoningEfforts]
            })
        ).toEqual({ effortControl: false })
        expect(getCustomModelReasoningFields(openRouterModel)).toEqual({ effortControl: false })
    })
})
