import type { ReasoningEffortTier, SharedModel } from "./types"

export const REASONING_EFFORT_RANK: Record<ReasoningEffortTier, number> = {
    off: 0,
    minimal: 1,
    low: 2,
    medium: 3,
    high: 4
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
