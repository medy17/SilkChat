import { useMemo } from "react"
import type { SharedModel } from "@/convex/lib/models"
import { useSyncedFavorites } from "@/hooks/use-synced-favorites"
import type { DisplayModel } from "@/lib/models-providers-shared"
import {
    DEFAULT_FAVORITE_MODEL_IDS,
    PREVIOUS_DEFAULT_FAVORITE_MODEL_ID_LISTS,
    getModelFavoritesStorageKey,
    resolveFavoriteModelId
} from "@/lib/model-favorites"

export function useModelFavorites(
    userId: string | undefined,
    availableModels: DisplayModel[],
    sharedModels: SharedModel[]
) {
    const resolveId = useMemo(() => {
        if (sharedModels.length === 0 || availableModels.length === 0) return undefined
        const availableModelIds = new Set(availableModels.map((model) => model.id))
        return (modelId: string) =>
            resolveFavoriteModelId({ modelId, sharedModels, availableModelIds })
    }, [availableModels, sharedModels])
    const { favoriteIds, canAddFavorite, toggleFavorite } = useSyncedFavorites({
        kind: "model",
        userId,
        legacyStorageKey: userId ? getModelFavoritesStorageKey(userId) : null,
        defaultIds: DEFAULT_FAVORITE_MODEL_IDS,
        previousDefaultIdLists: PREVIOUS_DEFAULT_FAVORITE_MODEL_ID_LISTS,
        resolveId
    })

    return { favoriteModelIds: favoriteIds, canAddFavorite, toggleFavorite }
}
