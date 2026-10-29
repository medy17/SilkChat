// @vitest-environment jsdom

import {
    LIBRARY_REFERENCES_STORE_KEY,
    STALE_REFERENCES_MS,
    areReferencesStale,
    useLibraryReferencesStore
} from "@/components/library/reference-store"
import { beforeEach, describe, expect, it } from "vitest"

const store = () => useLibraryReferencesStore.getState()

describe("library-reference-store", () => {
    beforeEach(() => {
        localStorage.removeItem(LIBRARY_REFERENCES_STORE_KEY)
        useLibraryReferencesStore.setState({ ownerId: "user-a", references: [], touchedAt: 0 })
    })

    it("persists uploaded references and dedupes by source hash", () => {
        store().addReference({ sourceHash: "hash-1", storageKey: "references/user-a/one.webp" })
        store().addReference({ sourceHash: "hash-1", storageKey: "references/user-a/again.webp" })

        expect(store().references).toEqual([
            { sourceHash: "hash-1", storageKey: "references/user-a/one.webp" }
        ])
        expect(
            JSON.parse(localStorage.getItem(LIBRARY_REFERENCES_STORE_KEY) || "{}").state.references
        ).toEqual(store().references)
    })

    it("drops another account's references when a new user claims the store", () => {
        store().addReference({ sourceHash: "hash-1", storageKey: "references/user-a/one.webp" })

        store().claimReferences("user-a")
        expect(store().references).toHaveLength(1)

        store().claimReferences("user-b")
        expect(store()).toMatchObject({ ownerId: "user-b", references: [], touchedAt: 0 })
    })

    it("treats references untouched for over a day as stale", () => {
        const now = 1_000_000_000
        expect(areReferencesStale(now - STALE_REFERENCES_MS, now)).toBe(false)
        expect(areReferencesStale(now - STALE_REFERENCES_MS - 1, now)).toBe(true)
    })
})
