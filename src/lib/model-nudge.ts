import type { SharedModel } from "@/convex/lib/models"
import {
    isModelNudged,
    isModelSunset,
    resolveModelReplacement
} from "@/convex/lib/models/lifecycle"

export const MODEL_NUDGE_SNOOZE_MS = 2 * 24 * 60 * 60 * 1000

// Ordered soft to blunt; each dismissal advances one line, after any model-specific lines.
export const GENERIC_MODEL_NUDGE_MESSAGES = [
    "{to} is the newer version of {from} and handles most chats better.",
    "We recommend {to} over {from} for new conversations.",
    "{from} trails {to} on most tasks. Switching takes one click.",
    "You're still on {from}. {to} is the better pick for almost everything."
]

export type ModelNudgeState = {
    snoozedUntil: number
    messageIndex: number
}

export type ModelNudge = {
    original: SharedModel
    replacement: SharedModel
}

export const resolveModelNudge = ({
    modelId,
    sharedModels,
    isCandidateAllowed
}: {
    modelId: string
    sharedModels: readonly SharedModel[]
    isCandidateAllowed: (model: SharedModel) => boolean
}): ModelNudge | null => {
    const original = sharedModels.find((model) => model.id === modelId)
    // Sunset models are migrated outright, not nudged.
    if (!original || isModelSunset(original) || !isModelNudged(original)) return null

    const resolution = resolveModelReplacement(modelId, sharedModels, {
        isCandidateAllowed,
        followNudges: true
    })
    if (!resolution.resolvedModel || resolution.resolvedModel.id === modelId) return null

    return { original, replacement: resolution.resolvedModel }
}

export const getModelNudgeMessage = (
    { original, replacement }: ModelNudge,
    messageIndex: number
) => {
    const messages = [...(original.nudgeMessages ?? []), ...GENERIC_MODEL_NUDGE_MESSAGES]
    const template = messages[messageIndex % messages.length]

    return template.replaceAll("{from}", original.name).replaceAll("{to}", replacement.name)
}

export const isModelNudgeSnoozed = (state: ModelNudgeState | null, now: number) =>
    Boolean(state && state.snoozedUntil > now)

export const snoozeModelNudge = (state: ModelNudgeState | null, now: number): ModelNudgeState => ({
    snoozedUntil: now + MODEL_NUDGE_SNOOZE_MS,
    messageIndex: (state?.messageIndex ?? 0) + 1
})
