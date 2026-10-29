import {
    DEFAULT_FAVORITE_PERSONA_KEYS,
    getDefaultFavoritePersonaKeys,
    getFavoritePersonaKeysByRecentlyAdded,
    getPersonaFavoritesStorageKey
} from "@/lib/persona-favorites"
import { describe, expect, it } from "vitest"

describe("persona favorites", () => {
    it("seeds a varied default set when no preference has been saved", () => {
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
    })

    it("scopes legacy local favorites to the signed-in user and preserves recent ordering", () => {
        expect(getPersonaFavoritesStorageKey("user-123")).toBe(
            "persona-selector-favorites:user-123"
        )
        expect(getFavoritePersonaKeysByRecentlyAdded(["builtin:older", "user:newer"])).toEqual([
            "user:newer",
            "builtin:older"
        ])
    })
})
