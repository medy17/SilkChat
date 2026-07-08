// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"

import { clearDevStorageScope, getDevStorageKeysForScope } from "@/lib/dev-tools"

describe("dev tools storage utilities", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it("clears only Convex disk cache keys for the Convex scope", () => {
        localStorage.setItem("CVX_DISK_CACHE:threads", "[]")
        localStorage.setItem("CVX_DISK_CACHE:settings", "{}")
        localStorage.setItem("model-storage", "{}")

        const cleared = clearDevStorageScope(localStorage, "convex")

        expect(cleared.sort()).toEqual(["CVX_DISK_CACHE:settings", "CVX_DISK_CACHE:threads"])
        expect(localStorage.getItem("CVX_DISK_CACHE:threads")).toBeNull()
        expect(localStorage.getItem("model-storage")).toBe("{}")
    })

    it("clears credit cache and library state independently", () => {
        localStorage.setItem("prototype-credit-summary:user-1", "{}")
        localStorage.setItem("prototype-credit-plan:user-1", "{}")
        localStorage.setItem("library-generation-store", "{}")
        localStorage.setItem("library-private-viewing-store", "{}")
        localStorage.setItem("theme-store", "{}")

        expect(getDevStorageKeysForScope(localStorage, "credits").sort()).toEqual([
            "prototype-credit-plan:user-1",
            "prototype-credit-summary:user-1"
        ])

        clearDevStorageScope(localStorage, "credits")

        expect(localStorage.getItem("prototype-credit-summary:user-1")).toBeNull()
        expect(localStorage.getItem("library-generation-store")).toBe("{}")

        clearDevStorageScope(localStorage, "library")

        expect(localStorage.getItem("library-generation-store")).toBeNull()
        expect(localStorage.getItem("library-private-viewing-store")).toBeNull()
        expect(localStorage.getItem("theme-store")).toBe("{}")
    })

    it("clears all app state as a union of supported scopes", () => {
        localStorage.setItem("CVX_DISK_CACHE:threads", "[]")
        localStorage.setItem("model-storage", "{}")
        localStorage.setItem("theme-store", "{}")
        localStorage.setItem("prototype-credit-summary:user-1", "{}")
        localStorage.setItem("library-generation-store", "{}")
        localStorage.setItem("unrelated-auth-token", "keep")

        const cleared = clearDevStorageScope(localStorage, "all-app-state")

        expect(cleared.sort()).toEqual([
            "CVX_DISK_CACHE:threads",
            "library-generation-store",
            "model-storage",
            "prototype-credit-summary:user-1",
            "theme-store"
        ])
        expect(localStorage.getItem("unrelated-auth-token")).toBe("keep")
    })
})
