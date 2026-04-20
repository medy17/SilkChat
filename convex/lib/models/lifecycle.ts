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

export const resolveModelReplacement = (
    modelId: string,
    models: readonly SharedModel[],
    options?: {
        date?: Date | string
        isCandidateAllowed?: (model: SharedModel) => boolean
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
    const chain: string[] = []
    const visited = new Set<string>()
    let currentId = modelId
    let sunsetModel: SharedModel | undefined

    for (let depth = 0; depth < MAX_REPLACEMENT_DEPTH; depth++) {
        if (visited.has(currentId)) {
            return {
                originalId: modelId,
                resolvedId: null,
                chain: [...chain, currentId],
                originalModel,
                sunsetModel,
                reason: "cycle"
            }
        }

        visited.add(currentId)
        chain.push(currentId)

        const currentModel = modelsById.get(currentId)
        if (!currentModel) {
            return {
                originalId: modelId,
                resolvedId: null,
                chain,
                originalModel,
                sunsetModel,
                reason: currentId === modelId ? "missing_original" : "missing_replacement"
            }
        }

        if (!isModelSunset(currentModel, date)) {
            if (options?.isCandidateAllowed && !options.isCandidateAllowed(currentModel)) {
                return {
                    originalId: modelId,
                    resolvedId: null,
                    chain,
                    originalModel,
                    resolvedModel: currentModel,
                    sunsetModel,
                    reason: "not_allowed"
                }
            }

            return {
                originalId: modelId,
                resolvedId: currentModel.id,
                chain,
                originalModel,
                resolvedModel: currentModel,
                sunsetModel,
                reason: currentModel.id === modelId ? "active" : "replaced"
            }
        }

        sunsetModel ??= currentModel

        if (!currentModel.replacementId) {
            return {
                originalId: modelId,
                resolvedId: null,
                chain,
                originalModel,
                sunsetModel,
                reason: "missing_replacement"
            }
        }

        currentId = currentModel.replacementId
    }

    return {
        originalId: modelId,
        resolvedId: null,
        chain,
        originalModel,
        sunsetModel,
        reason: "depth_exceeded"
    }
}
