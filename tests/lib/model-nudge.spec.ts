import type { SharedModel } from "@/convex/lib/models"
import {
    GENERIC_MODEL_NUDGE_MESSAGES,
    MODEL_NUDGE_SNOOZE_MS,
    getModelNudgeMessage,
    isModelNudgeSnoozed,
    resolveModelNudge,
    snoozeModelNudge
} from "@/lib/model-nudge"
import { describe, expect, it } from "vitest"

const createModel = (overrides: Partial<SharedModel>): SharedModel =>
    ({
        id: "test-model",
        name: "Test Model",
        adapters: ["openrouter:vendor/model"],
        abilities: [],
        ...overrides
    }) as SharedModel

const models = [
    createModel({
        id: "old",
        name: "Old",
        replacementId: "new",
        nudgeToReplacement: true,
        nudgeMessages: ["{to} beats {from}."]
    }),
    createModel({ id: "new", name: "New" }),
    createModel({ id: "plain", name: "Plain", replacementId: "new" }),
    createModel({
        id: "retired",
        name: "Retired",
        sunsetOn: "2020-01-01",
        replacementId: "new",
        nudgeToReplacement: true
    })
]

const allowAll = () => true

describe("model nudges", () => {
    it("nudges only live models flagged for it", () => {
        expect(
            resolveModelNudge({
                modelId: "old",
                sharedModels: models,
                isCandidateAllowed: allowAll
            })?.replacement.id
        ).toBe("new")
        expect(
            resolveModelNudge({
                modelId: "plain",
                sharedModels: models,
                isCandidateAllowed: allowAll
            })
        ).toBeNull()
        expect(
            resolveModelNudge({
                modelId: "retired",
                sharedModels: models,
                isCandidateAllowed: allowAll
            })
        ).toBeNull()
    })

    it("stays quiet when the user cannot pick any replacement", () => {
        expect(
            resolveModelNudge({
                modelId: "old",
                sharedModels: models,
                isCandidateAllowed: (model) => model.id === "old"
            })
        ).toBeNull()
    })

    it("shows model-specific lines first, then cycles through the generic ones", () => {
        const nudge = resolveModelNudge({
            modelId: "old",
            sharedModels: models,
            isCandidateAllowed: allowAll
        })!
        const total = 1 + GENERIC_MODEL_NUDGE_MESSAGES.length

        expect(getModelNudgeMessage(nudge, 0)).toBe("New beats Old.")
        expect(getModelNudgeMessage(nudge, 1)).not.toContain("{")
        expect(getModelNudgeMessage(nudge, 1)).not.toBe(getModelNudgeMessage(nudge, 0))
        expect(getModelNudgeMessage(nudge, total)).toBe("New beats Old.")
    })

    it("snoozes after a dismissal and advances to the next line", () => {
        const now = 1_000_000
        const first = snoozeModelNudge(null, now)
        const second = snoozeModelNudge(first, now)

        expect(first.messageIndex).toBe(1)
        expect(second.messageIndex).toBe(2)
        expect(isModelNudgeSnoozed(first, now + MODEL_NUDGE_SNOOZE_MS - 1)).toBe(true)
        expect(isModelNudgeSnoozed(first, now + MODEL_NUDGE_SNOOZE_MS)).toBe(false)
        expect(isModelNudgeSnoozed(null, now)).toBe(false)
    })
})
