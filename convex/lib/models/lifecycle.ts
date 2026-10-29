import type { SharedModel } from "./types"

const MODEL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_REPLACEMENT_DEPTH = 20

export type ModelReplacementResolution = {
    originalId: string
    resolvedId: string | null
    chain: string[]
    originalModel?: SharedModel
    resolvedModel?: SharedModel
    sunsetModel?: SharedModel
    reason:
        | "active"
        | "replaced"
        | "missing_original"
        | "missing_replacement"
        | "cycle"
        | "depth_exceeded"
        | "not_allowed"
}

export const getModelDateKey = (date: Date | string = new Date()) => {
    if (typeof date === "string") {
        return MODEL_DATE_PATTERN.test(date) ? date : date.slice(0, 10)
    }

    return date.toISOString().slice(0, 10)
}

export const isModelSunset = (
    model: Pick<SharedModel, "sunsetOn">,
    date: Date | string = new Date()
) => Boolean(model.sunsetOn && model.sunsetOn <= getModelDateKey(date))

export const isModelNudged = (model: Pick<SharedModel, "nudgeToReplacement" | "replacementId">) =>
    Boolean(model.nudgeToReplacement && model.replacementId)

/**
 * Walks the `replacementId` chain to the furthest model the caller can use.
 *
 * Sunset models always move on. Nudged models are skipped once a sunset move is under way, so a
 * forced migration never lands somewhere that would immediately nudge again. `followNudges`
 * also moves off a nudged starting model; without it a live nudged model resolves to itself.
 */
export const resolveModelReplacement = (
    modelId: string,
    models: readonly SharedModel[],
    options?: {
        date?: Date | string
        isCandidateAllowed?: (model: SharedModel) => boolean
        followNudges?: boolean
    }
): ModelReplacementResolution => {
    const modelsById = new Map(models.map((model) => [model.id, model]))
    const originalModel = modelsById.get(modelId)

    if (!originalModel) {
        return {
            originalId: modelId,
            resolvedId: null,
            chain: [modelId],
            reason: "missing_original"
        }
    }

    const date = options?.date ?? new Date()
    const isUsable = (model: SharedModel) =>
        !isModelSunset(model, date) && (options?.isCandidateAllowed?.(model) ?? true)

    const chain: string[] = []
    const visited = new Set<string>()
    let currentId = modelId
    let sunsetModel: SharedModel | undefined
    // The furthest usable model so far; a dead end later in the chain falls back to it.
    let restingModel: SharedModel | undefined
    let failure: Exclude<ModelReplacementResolution["reason"], "active" | "replaced"> =
        "depth_exceeded"
    let blockedModel: SharedModel | undefined

    for (let depth = 0; depth < MAX_REPLACEMENT_DEPTH; depth++) {
        if (visited.has(currentId)) {
            chain.push(currentId)
            failure = "cycle"
            break
        }

        visited.add(currentId)
        chain.push(currentId)

        const currentModel = modelsById.get(currentId)
        if (!currentModel) {
            failure = "missing_replacement"
            break
        }

        if (isUsable(currentModel)) restingModel = currentModel

        const sunset = isModelSunset(currentModel, date)
        if (sunset) sunsetModel ??= currentModel

        const advances =
            sunset || (isModelNudged(currentModel) && (depth > 0 || options?.followNudges === true))

        if (!advances) {
            if (restingModel !== currentModel) {
                failure = "not_allowed"
                blockedModel = currentModel
            }
            break
        }

        if (!currentModel.replacementId) {
            failure = "missing_replacement"
            break
        }

        currentId = currentModel.replacementId
    }

    if (restingModel) {
        return {
            originalId: modelId,
            resolvedId: restingModel.id,
            chain,
            originalModel,
            resolvedModel: restingModel,
            sunsetModel,
            reason: restingModel.id === modelId ? "active" : "replaced"
        }
    }

    return {
        originalId: modelId,
        resolvedId: null,
        chain,
        originalModel,
        resolvedModel: blockedModel,
        sunsetModel,
        reason: failure
    }
}
