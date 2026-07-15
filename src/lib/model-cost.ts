import type { SharedModel } from "@/convex/lib/models"

export type ModelCostLevel = 0 | 1 | 2 | 3 | 4

/**
 * Representative price points for the five compact cost bands. Models are
 * assigned to the closest anchor on a logarithmic scale.
 */
export const MODEL_COST_ANCHORS_USD_PER_1M = [0.15, 0.75, 2.5, 6, 12] as const

type PricedModel = Pick<SharedModel, "inputUsdPer1MTokens" | "outputUsdPer1MTokens">

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0

export const getModelEffectivePrice = ({
    inputUsdPer1MTokens,
    outputUsdPer1MTokens
}: PricedModel): number | null => {
    if (
        !isNonNegativeFiniteNumber(inputUsdPer1MTokens) ||
        !isNonNegativeFiniteNumber(outputUsdPer1MTokens)
    ) {
        return null
    }

    if (inputUsdPer1MTokens === 0 && outputUsdPer1MTokens === 0) {
        return 0
    }

    if (inputUsdPer1MTokens === 0 || outputUsdPer1MTokens === 0) {
        return null
    }

    return Math.sqrt(inputUsdPer1MTokens * outputUsdPer1MTokens)
}

export const getModelCostLevel = (model: PricedModel): ModelCostLevel | null => {
    const effectivePrice = getModelEffectivePrice(model)
    if (effectivePrice === null) return null
    if (effectivePrice === 0) return 0

    let closestLevel: ModelCostLevel = 0
    let closestDistance = Number.POSITIVE_INFINITY

    for (const [index, anchor] of MODEL_COST_ANCHORS_USD_PER_1M.entries()) {
        const distance = Math.abs(Math.log(effectivePrice / anchor))
        if (distance < closestDistance) {
            closestLevel = index as ModelCostLevel
            closestDistance = distance
        }
    }

    return closestLevel
}
