import type { ReasoningEffortTier, SharedModel } from "./types"

export const REASONING_EFFORT_RANK: Record<ReasoningEffortTier, number> = {
    off: 0,
    minimal: 1,
    low: 2,
    medium: 3,
    high: 4,
    xhigh: 5,
    max: 6
}

export const getAllowedReasoningEffortsForModel = (
    model: SharedModel | null | undefined
): ReasoningEffortTier[] => {
    if (!model?.abilities.includes("reasoning")) return []

    if (model.reasoningEfforts?.length) {
        return model.reasoningEfforts
    }

    if (model.abilities.includes("effort_control")) {
        return model.supportsDisablingReasoning
            ? ["off", "low", "medium", "high"]
            : ["low", "medium", "high"]
    }

    if (model.supportsDisablingReasoning) {
        return ["off", "medium"]
    }

    return ["medium"]
}

export const getDefaultReasoningEffortForModel = (
    model: SharedModel | null | undefined
): ReasoningEffortTier | null => {
    const allowedEfforts = getAllowedReasoningEffortsForModel(model)
    if (!allowedEfforts.length) return null

    if (model?.defaultReasoningEffort && allowedEfforts.includes(model.defaultReasoningEffort)) {
        return model.defaultReasoningEffort
    }

    if (model?.abilities.includes("effort_control")) {
        return model.supportsDisablingReasoning ? "off" : (allowedEfforts[0] ?? "low")
    }

    if (model?.supportsDisablingReasoning) {
        return "off"
    }

    return allowedEfforts[0] ?? "medium"
}

export const getNearestReasoningEffort = (
    requestedEffort: ReasoningEffortTier,
    allowedEfforts: ReasoningEffortTier[]
): ReasoningEffortTier | null => {
    if (!allowedEfforts.length) return null

    const requestedRank = REASONING_EFFORT_RANK[requestedEffort]
    const nearestLowerEffort = allowedEfforts
        .filter((effort) => REASONING_EFFORT_RANK[effort] <= requestedRank)
        .sort((left, right) => REASONING_EFFORT_RANK[right] - REASONING_EFFORT_RANK[left])[0]

    return nearestLowerEffort ?? allowedEfforts[0] ?? null
}

export const resolveReasoningEffortForModel = (
    model: SharedModel | null | undefined,
    requestedEffort?: ReasoningEffortTier
): ReasoningEffortTier | null => {
    const allowedEfforts = getAllowedReasoningEffortsForModel(model)
    if (!allowedEfforts.length) return requestedEffort ?? null

    if (requestedEffort && allowedEfforts.includes(requestedEffort)) {
        return requestedEffort
    }

    const defaultEffort = getDefaultReasoningEffortForModel(model)
    if (defaultEffort && allowedEfforts.includes(defaultEffort)) {
        return defaultEffort
    }

    if (!requestedEffort) {
        return allowedEfforts[0] ?? null
    }

    return getNearestReasoningEffort(requestedEffort, allowedEfforts)
}

export const sortReasoningEfforts = (efforts: readonly ReasoningEffortTier[]) =>
    [...new Set(efforts)].sort(
        (left, right) => REASONING_EFFORT_RANK[left] - REASONING_EFFORT_RANK[right]
    )

// Runtime reasoning fields for a custom model. Only OpenRouter custom models, which always
// run on the user's own key, use stored levels; the rest keep always-on reasoning.
export const getCustomModelReasoningFields = (model: {
    providerId: string
    abilities: readonly string[]
    reasoningEfforts?: readonly ReasoningEffortTier[]
    defaultReasoningEffort?: ReasoningEffortTier
}): {
    effortControl: boolean
    reasoningEfforts?: ReasoningEffortTier[]
    supportsDisablingReasoning?: boolean
    defaultReasoningEffort?: ReasoningEffortTier
} => {
    if (
        model.providerId !== "openrouter" ||
        !model.abilities.includes("reasoning") ||
        !model.reasoningEfforts
    ) {
        return { effortControl: false }
    }

    const levels = sortReasoningEfforts(model.reasoningEfforts)
    const supportsDisablingReasoning = levels.includes("off")

    // No levels besides "off": a plain on/off toggle, or always on.
    if (!levels.some((level) => level !== "off")) {
        return { effortControl: false, supportsDisablingReasoning }
    }

    return {
        effortControl: true,
        reasoningEfforts: levels,
        supportsDisablingReasoning,
        defaultReasoningEffort:
            model.defaultReasoningEffort && levels.includes(model.defaultReasoningEffort)
                ? model.defaultReasoningEffort
                : undefined
    }
}
