const PATCH_SIZE = 32
const DEFAULT_PATCH_BUDGET = 1_536

export type ImageDimensions = { width: number; height: number }

const getModelMultiplier = (modelId?: string) => {
    const normalized = modelId?.toLowerCase() ?? ""
    if (/gpt-5(?:\.4)?-nano|gpt-4\.1-nano/.test(normalized)) return 2.46
    if (/gpt-5(?:\.4)?-mini|gpt-4\.1-mini/.test(normalized)) return 1.62
    if (normalized.includes("o4-mini")) return 1.72
    return 1
}

const patchCountAtScale = (width: number, height: number, scale: number) =>
    Math.ceil((width * scale) / PATCH_SIZE) * Math.ceil((height * scale) / PATCH_SIZE)

/**
 * Composer-level vision estimate based on the common 32px patch model. This is
 * deliberately a routing heuristic, not a claim of exact provider billing.
 */
export const estimateImageInputTokens = (
    dimensions: ImageDimensions | undefined,
    modelId?: string
) => {
    if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
        return DEFAULT_PATCH_BUDGET
    }

    const { width, height } = dimensions
    const originalPatches = patchCountAtScale(width, height, 1)
    let patches = originalPatches

    if (originalPatches > DEFAULT_PATCH_BUDGET) {
        let low = 0
        let high = 1
        for (let index = 0; index < 24; index += 1) {
            const midpoint = (low + high) / 2
            if (patchCountAtScale(width, height, midpoint) <= DEFAULT_PATCH_BUDGET) {
                low = midpoint
            } else {
                high = midpoint
            }
        }
        patches = patchCountAtScale(width, height, low)
    }

    return Math.ceil(patches * getModelMultiplier(modelId))
}
