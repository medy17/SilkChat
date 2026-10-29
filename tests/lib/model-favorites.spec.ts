import type { SharedModel } from "@/convex/lib/models"
import {
    DEFAULT_FAVORITE_MODEL_IDS,
    getFavoriteModelIdsByRecentlyAdded,
    getFavoriteToggleAction,
    getModelFavoritesStorageKey,
    reconcileFavoriteModelIds,
    resolveFavoriteModelIds
} from "@/lib/model-favorites"
import { describe, expect, it } from "vitest"

describe("model favorites", () => {
    it("seeds a varied default set when no preference has been saved", () => {
        expect(resolveFavoriteModelIds(null)).toEqual(DEFAULT_FAVORITE_MODEL_IDS)
        expect(getFavoriteModelIdsByRecentlyAdded(DEFAULT_FAVORITE_MODEL_IDS)).toEqual([
            "gpt-6-luna",
            "claude-sonnet-5.5",
            "gpt-6.1-sol",
            "gemini-3.8-flash",
            "grok-4.7",
            "deepseek-v4-pro-0813"
        ])
    })

    it("preserves an intentionally empty favorites list", () => {
        expect(resolveFavoriteModelIds("[]")).toEqual([])
    })

    it("deduplicates saved model ids and recovers from invalid data", () => {
        expect(resolveFavoriteModelIds('["model-a","model-a","model-b"]')).toEqual([
            "model-a",
            "model-b"
        ])
        expect(resolveFavoriteModelIds("not-json")).toEqual(DEFAULT_FAVORITE_MODEL_IDS)
    })

    it("scopes favorites to the signed-in user", () => {
        expect(getModelFavoritesStorageKey("user-123")).toBe("model-selector-favorites:user-123")
    })

    it("orders favorites by most recently added", () => {
        const storedOrder = ["oldest", "middle", "newest"]

        expect(getFavoriteModelIdsByRecentlyAdded(storedOrder)).toEqual([
            "newest",
            "middle",
            "oldest"
        ])
        expect(storedOrder).toEqual(["oldest", "middle", "newest"])
    })

    it("requires a second activation before removing a favorite", () => {
        expect(getFavoriteToggleAction({ isFavorite: false, isRemovalArmed: false })).toBe("add")
        expect(getFavoriteToggleAction({ isFavorite: true, isRemovalArmed: false })).toBe(
            "arm-removal"
        )
        expect(getFavoriteToggleAction({ isFavorite: true, isRemovalArmed: true })).toBe("remove")
    })

    it("migrates sunset favorites to an available replacement", () => {
        const sharedModels = [
            {
                id: "sunset-model",
                name: "Sunset Model",
                adapters: [],
                abilities: [],
                sunsetOn: "2020-01-01",
                replacementId: "replacement-model"
            },
            {
                id: "replacement-model",
                name: "Replacement Model",
                adapters: [],
                abilities: []
            }
        ] as SharedModel[]

        expect(
            reconcileFavoriteModelIds({
                favoriteModelIds: ["sunset-model"],
                sharedModels,
                availableModelIds: new Set(["replacement-model"])
            })
        ).toEqual(["replacement-model"])
    })

    it("prunes removed custom models and models from removed providers", () => {
        expect(
            reconcileFavoriteModelIds({
                favoriteModelIds: ["available-model", "removed-custom", "removed-provider-model"],
                sharedModels: [],
                availableModelIds: new Set(["available-model"])
            })
        ).toEqual(["available-model"])
    })
})
