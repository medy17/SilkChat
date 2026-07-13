export const PERSONA_ONBOARDING_PATH = "/personas/start"

const HANDOFF_KEY = "persona-onboarding-handoff"
// The handoff survives remounts/resets of the chat until a thread actually
// starts or the user overrides it, so it needs a shelf life instead of a
// one-shot consume.
const HANDOFF_TTL_MS = 5 * 60 * 1000

export type PersonaOnboardingHandoff = {
    source: "builtin" | "user"
    id: string
    defaultModelId?: string
    opening: {
        id: string
        messageId: string
        text: string
        suggestedReplies: string[]
    }
}

export function setPersonaOnboardingHandoff(handoff: PersonaOnboardingHandoff) {
    try {
        sessionStorage.setItem(
            HANDOFF_KEY,
            JSON.stringify({ ...handoff, expiresAt: Date.now() + HANDOFF_TTL_MS })
        )
    } catch {
        // Storage unavailable (private mode) — the user just lands on a default chat.
    }
}

export function peekPersonaOnboardingHandoff(): PersonaOnboardingHandoff | null {
    try {
        const raw = sessionStorage.getItem(HANDOFF_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (typeof parsed?.expiresAt !== "number" || parsed.expiresAt < Date.now()) {
            sessionStorage.removeItem(HANDOFF_KEY)
            return null
        }
        if (
            (parsed?.source === "builtin" || parsed?.source === "user") &&
            typeof parsed?.id === "string" &&
            typeof parsed?.opening?.id === "string" &&
            typeof parsed?.opening?.messageId === "string" &&
            typeof parsed?.opening?.text === "string" &&
            Array.isArray(parsed?.opening?.suggestedReplies) &&
            parsed.opening.suggestedReplies.every((reply: unknown) => typeof reply === "string")
        ) {
            return {
                source: parsed.source,
                id: parsed.id,
                defaultModelId:
                    typeof parsed.defaultModelId === "string" ? parsed.defaultModelId : undefined,
                opening: {
                    id: parsed.opening.id,
                    messageId: parsed.opening.messageId,
                    text: parsed.opening.text,
                    suggestedReplies: parsed.opening.suggestedReplies
                }
            }
        }
        sessionStorage.removeItem(HANDOFF_KEY)
        return null
    } catch {
        return null
    }
}

export function clearPersonaOnboardingHandoff() {
    try {
        sessionStorage.removeItem(HANDOFF_KEY)
    } catch {
        // Nothing to clean up if storage is unavailable.
    }
}
