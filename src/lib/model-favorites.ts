import type { SharedModel } from "@/convex/lib/models"
import { resolveModelReplacement } from "@/convex/lib/models/lifecycle"

export const FAVORITES_SECTION_ID = "favorites"

export const DEFAULT_FAVORITE_MODEL_IDS = [
    "gpt-5.6-sol",
    "claude-sonnet-5",
    "gemini-3.5-flash",
    "grok-4.5",
    "deepseek-v4-pro"
] as const

export const getModelFavoritesStorageKey = (userId: string) => `model-selector-favorites:${userId}`

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

export const resolveFavoriteModelIds = (storedValue: string | null): string[] => {
    if (storedValue === null) return [...DEFAULT_FAVORITE_MODEL_IDS]

    try {
        const parsed = JSON.parse(storedValue)
        if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
            return [...DEFAULT_FAVORITE_MODEL_IDS]
        }

        return [...new Set(parsed)]
    } catch {
        return [...DEFAULT_FAVORITE_MODEL_IDS]
    }
}

export const reconcileFavoriteModelIds = ({
    favoriteModelIds,
    sharedModels,
    availableModelIds
}: {
    favoriteModelIds: readonly string[]
    sharedModels: readonly SharedModel[]
    availableModelIds: ReadonlySet<string>
}) => {
    const reconciledIds: string[] = []

    for (const modelId of favoriteModelIds) {
        let resolvedId = availableModelIds.has(modelId) ? modelId : null

        if (!resolvedId && sharedModels.some((model) => model.id === modelId)) {
            resolvedId = resolveModelReplacement(modelId, sharedModels, {
                isCandidateAllowed: (model) => availableModelIds.has(model.id)
            }).resolvedId
        }

        if (resolvedId && !reconciledIds.includes(resolvedId)) {
            reconciledIds.push(resolvedId)
        }
    }

    return reconciledIds
}
