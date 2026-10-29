import {
    MAX_FAVORITES,
    getNextFavoriteIds,
    isUntouchedDefaultFavoriteList,
    mergeImportedFavoriteIds,
    parseLegacyFavoriteIds
} from "@/lib/synced-favorites"
import { describe, expect, it } from "vitest"

const fullList = Array.from({ length: MAX_FAVORITES.model }, (_, index) => `model-${index}`)

describe("synced favorites", () => {
    it("starts from the shown list until the user has a synced one", () => {
        const change = { kind: "model", seed: ["a", "b"], replacements: [] } as const

        expect(
            getNextFavoriteIds({ ...change, storedIds: undefined, id: "c", isFavorite: true })
        ).toEqual(["a", "b", "c"])
        expect(getNextFavoriteIds({ ...change, storedIds: [], id: "c", isFavorite: true })).toEqual(
            ["c"]
        )
    })

    it("refuses additions past the cap but always allows removals", () => {
        const change = { kind: "model", storedIds: fullList, seed: [], replacements: [] } as const

        expect(getNextFavoriteIds({ ...change, id: "extra", isFavorite: true })).toBeNull()
        expect(getNextFavoriteIds({ ...change, id: "model-0", isFavorite: false })).toHaveLength(
            MAX_FAVORITES.model - 1
        )
    })

    it("frees a slot when a stale favorite is dropped before counting the cap", () => {
        expect(
            getNextFavoriteIds({
                kind: "model",
                storedIds: fullList,
                seed: [],
                replacements: [{ from: "model-3", to: null }],
                id: "extra",
                isFavorite: true
            })
        ).toEqual([...fullList.filter((id) => id !== "model-3"), "extra"])
    })

    it("keeps a retired favorite's position when it maps onto a replacement", () => {
        expect(
            getNextFavoriteIds({
                kind: "model",
                storedIds: ["retired", "kept", "replacement"],
                seed: [],
                replacements: [{ from: "retired", to: "replacement" }],
                id: "new",
                isFavorite: true
            })
        ).toEqual(["replacement", "kept", "new"])
    })

    it("merges browser imports after synced favorites and keeps them past the cap", () => {
        expect(mergeImportedFavoriteIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"])
        expect(mergeImportedFavoriteIds(fullList, ["extra"])).toHaveLength(MAX_FAVORITES.model + 1)
        expect(mergeImportedFavoriteIds(undefined, [])).toEqual([])
    })

    it("reads legacy local lists and ignores missing or corrupt values", () => {
        expect(parseLegacyFavoriteIds('["a","a","b"]')).toEqual(["a", "b"])
        expect(parseLegacyFavoriteIds("[]")).toEqual([])
        expect(parseLegacyFavoriteIds(null)).toBeNull()
        expect(parseLegacyFavoriteIds("not-json")).toBeNull()
        expect(parseLegacyFavoriteIds('[1, "a"]')).toBeNull()
    })

    it("treats saved default lists as untouched, including reconciled older defaults", () => {
        const reconcile = (ids: readonly string[]) =>
            ids.map((id) => (id === "old-default" ? "new-default" : id))
        const defaultLists = [
            ["new-default", "other"],
            ["old-default", "other"]
        ]

        expect(
            isUntouchedDefaultFavoriteList(["other", "old-default"], defaultLists, reconcile)
        ).toBe(true)
        expect(
            isUntouchedDefaultFavoriteList(["other", "new-default"], defaultLists, reconcile)
        ).toBe(true)
        expect(isUntouchedDefaultFavoriteList(["other"], defaultLists, reconcile)).toBe(false)
        expect(isUntouchedDefaultFavoriteList([], defaultLists, reconcile)).toBe(false)
    })
})
