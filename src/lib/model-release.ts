import type { SharedModel } from "@/convex/lib/models"
import type { DisplayModel } from "@/lib/models-providers-shared"

export const NEW_MODEL_TIMEFRAME_MS = 14 * 24 * 60 * 60 * 1000

export const isNewModelRelease = (model: DisplayModel, now = Date.now()) => {
    if ("isCustom" in model && model.isCustom) return false

    const sharedModel = model as SharedModel
    if (sharedModel.legacy || !sharedModel.addedOn) return false

    const addedOn = Date.parse(sharedModel.addedOn)
    if (!Number.isFinite(addedOn)) return false

    const age = now - addedOn
    return age >= 0 && age <= NEW_MODEL_TIMEFRAME_MS
}
