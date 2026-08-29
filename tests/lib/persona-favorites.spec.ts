import {
    DEFAULT_FAVORITE_PERSONA_KEYS,
    getDefaultFavoritePersonaKeys,
    getFavoritePersonaKeysByRecentlyAdded,
    getPersonaFavoritesStorageKey,
    reconcileFavoritePersonaKeys,
    resolveFavoritePersonaKeys
} from "@/lib/persona-favorites"
import { describe, expect, it } from "vitest"

describe("persona favorites", () => {
    it("seeds a varied default set when no preference has been saved", () => {
        expect(resolveFavoritePersonaKeys(null)).toEqual(DEFAULT_FAVORITE_PERSONA_KEYS)
        expect(getFavoritePersonaKeysByRecentlyAdded(DEFAULT_FAVORITE_PERSONA_KEYS)).toEqual([
            "builtin:elara-adventurer",
            "builtin:brooding-stranger",
            "builtin:monday",
            "builtin:essay-columnist",
            "builtin:senior-code-reviewer",
            "builtin:socratic-tutor"
        ])
    })

    it("places up to three existing custom personas ahead of built-in defaults", () => {
        const defaults = getDefaultFavoritePersonaKeys([
            "user:first",
            "user:second",
            "user:third",
            "user:fourth"
        ])

        expect(getFavoritePersonaKeysByRecentlyAdded(defaults)).toEqual([
            "user:first",
            "user:second",
            "user:third",
            "builtin:elara-adventurer",
            "builtin:brooding-stranger",
            "builtin:monday"
        ])
        expect(resolveFavoritePersonaKeys(null, defaults)).toEqual(defaults)
    })

    it("preserves an intentionally empty favorites list", () => {
        expect(resolveFavoritePersonaKeys("[]")).toEqual([])
    })

    it("scopes favorites to the signed-in user and preserves recent ordering", () => {
        expect(getPersonaFavoritesStorageKey("user-123")).toBe(
            "persona-selector-favorites:user-123"
        )
        expect(getFavoritePersonaKeysByRecentlyAdded(["builtin:older", "user:newer"])).toEqual([
            "user:newer",
            "builtin:older"
        ])
    })

    it("deduplicates valid saved keys and recovers safely from invalid data", () => {
        expect(
            resolveFavoritePersonaKeys('["builtin:ada","builtin:ada","user:persona-1"]')
        ).toEqual(["builtin:ada", "user:persona-1"])
        expect(resolveFavoritePersonaKeys("not-json")).toEqual(DEFAULT_FAVORITE_PERSONA_KEYS)
    })

    it("prunes personas that are no longer available", () => {
        expect(
            reconcileFavoritePersonaKeys({
                favoritePersonaKeys: ["builtin:ada", "user:deleted"],
                availablePersonaKeys: new Set(["builtin:ada"])
            })
        ).toEqual(["builtin:ada"])
    })
})
