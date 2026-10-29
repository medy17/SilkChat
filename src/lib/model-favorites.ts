import type { SharedModel } from "@/convex/lib/models"
import { resolveModelReplacement } from "@/convex/lib/models/lifecycle"

export const FAVORITES_SECTION_ID = "favorites"

export const DEFAULT_FAVORITE_MODEL_IDS = [
    "deepseek-v4-pro-0813",
    "grok-4.7",
    "gemini-3.8-flash",
    "gpt-6.1-sol",
    "claude-sonnet-5.5",
    "gpt-6-luna"
] as const

// Earlier defaults that browsers may have saved locally without the user choosing them.
export const PREVIOUS_DEFAULT_FAVORITE_MODEL_ID_LISTS = [
    ["gpt-5.6-sol", "claude-sonnet-5", "gemini-3.5-flash", "grok-4.5", "deepseek-v4-pro"],
    [
        "deepseek-v4-pro-0813",
        "grok-4.6",
        "gemini-3.5-flash",
        "claude-sonnet-5",
        "gpt-5.6-sol",
        "gpt-5.6-luna"
    ]
] as const

/** Pre-sync localStorage key, read once per browser to import into synced settings. */
export const getModelFavoritesStorageKey = (userId: string) => `model-selector-favorites:${userId}`

export const getFavoriteModelIdsByRecentlyAdded = (favoriteModelIds: readonly string[]) =>
    [...favoriteModelIds].reverse()

export const getFavoriteToggleAction = ({
    isFavorite,
    isRemovalArmed
}: {
    isFavorite: boolean
    isRemovalArmed: boolean
}): "add" | "arm-removal" | "remove" => {
    if (!isFavorite) return "add"
    return isRemovalArmed ? "remove" : "arm-removal"
}

/** Returns the available model a favorite now points at, or null when it should be dropped. */
export const resolveFavoriteModelId = ({
    modelId,
    sharedModels,
    availableModelIds
}: {
    modelId: string
    sharedModels: readonly SharedModel[]
    availableModelIds: ReadonlySet<string>
}) => {
    if (availableModelIds.has(modelId)) return modelId
    if (!sharedModels.some((model) => model.id === modelId)) return null

    return resolveModelReplacement(modelId, sharedModels, {
        isCandidateAllowed: (model) => availableModelIds.has(model.id)
    }).resolvedId
}
