import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    clearPersonaOnboardingHandoff,
    peekPersonaOnboardingHandoff,
    setPersonaOnboardingHandoff
} from "../../src/lib/persona-onboarding"

const createSessionStorage = () => {
    const values = new Map<string, string>()
    return {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => values.set(key, value)),
        removeItem: vi.fn((key: string) => values.delete(key))
    }
}

describe("persona onboarding handoff", () => {
    beforeEach(() => {
        vi.stubGlobal("sessionStorage", createSessionStorage())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("round-trips the pending persona opening needed for a lazy first send", () => {
        const handoff = {
            source: "builtin" as const,
            id: "elara-adventurer",
            defaultModelId: "model-1",
            opening: {
                id: "summoned-arrival",
                messageId: "opening-message-1",
                text: "You are one of the summoned, aren't you?",
                suggestedReplies: ["I was just walking home."]
            }
        }

        setPersonaOnboardingHandoff(handoff)

        expect(peekPersonaOnboardingHandoff()).toEqual(handoff)
    })

    it("discards legacy handoffs that cannot identify an authoritative opening", () => {
        sessionStorage.setItem(
            "persona-onboarding-handoff",
            JSON.stringify({
                source: "builtin",
                id: "elara-adventurer",
                expiresAt: Date.now() + 60_000
            })
        )

        expect(peekPersonaOnboardingHandoff()).toBeNull()
        expect(sessionStorage.removeItem).toHaveBeenCalledWith("persona-onboarding-handoff")
    })

    it("clears the pending handoff once a thread exists", () => {
        clearPersonaOnboardingHandoff()

        expect(sessionStorage.removeItem).toHaveBeenCalledWith("persona-onboarding-handoff")
    })
})
