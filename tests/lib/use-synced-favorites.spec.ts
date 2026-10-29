// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { importLocalFavorites, setFavorite, settingsState } = vi.hoisted(() => ({
    importLocalFavorites: vi.fn(),
    setFavorite: vi.fn(),
    settingsState: { current: {} as Record<string, unknown> }
}))

vi.mock("@/convex/_generated/api", () => ({
    api: {
        settings: {
            getUserSettings: "getUserSettings",
            importLocalFavorites: "importLocalFavorites",
            setFavorite: "setFavorite"
        }
    }
}))
vi.mock("convex/react", () => ({
    useMutation: (reference: string) =>
        reference === "importLocalFavorites"
            ? importLocalFavorites
            : Object.assign(setFavorite, { withOptimisticUpdate: () => setFavorite })
}))
vi.mock("@convex-dev/react-query", () => ({
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true })
}))
vi.mock("@/hooks/use-current-user-settings", () => ({
    useCurrentUserSettings: () => settingsState.current
}))

import { useSyncedFavorites } from "@/hooks/use-synced-favorites"

const defaultIds = ["default-a", "default-b"]
const keepAll = (id: string) => id

const renderFavorites = (userId: string, resolveId: (id: string) => string | null = keepAll) =>
    renderHook(() =>
        useSyncedFavorites({
            kind: "model",
            userId,
            legacyStorageKey: `legacy:${userId}`,
            defaultIds,
            resolveId
        })
    )

describe("synced favorites hook", () => {
    beforeEach(() => {
        window.localStorage.clear()
        settingsState.current = {}
        importLocalFavorites.mockReset().mockResolvedValue(null)
        setFavorite.mockReset().mockResolvedValue(null)
    })
    afterEach(cleanup)

    it("shows a browser's local list until its one-time import lands, then clears it", async () => {
        window.localStorage.setItem("legacy:one", '["custom-a","custom-b"]')

        const picker = renderFavorites("one")
        renderFavorites("one")

        expect(picker.result.current.favoriteIds).toEqual(["custom-a", "custom-b"])
        await waitFor(() => expect(window.localStorage.getItem("legacy:one")).toBeNull())
        expect(importLocalFavorites).toHaveBeenCalledTimes(1)
        expect(importLocalFavorites).toHaveBeenCalledWith({
            kind: "model",
            ids: ["custom-a", "custom-b"]
        })
    })

    it("discards a local list that only holds the defaults instead of importing it", async () => {
        window.localStorage.setItem("legacy:two", '["default-b","default-a"]')

        renderFavorites("two")

        await waitFor(() => expect(window.localStorage.getItem("legacy:two")).toBeNull())
        expect(importLocalFavorites).not.toHaveBeenCalled()
    })

    it("keeps the local list for a retry when the import fails", async () => {
        window.localStorage.setItem("legacy:three", '["custom-a"]')
        importLocalFavorites.mockRejectedValueOnce(new Error("offline"))

        const hook = renderFavorites("three")

        await waitFor(() => expect(importLocalFavorites).toHaveBeenCalledTimes(1))
        expect(window.localStorage.getItem("legacy:three")).toBe('["custom-a"]')
        expect(hook.result.current.favoriteIds).toEqual(["custom-a"])
    })

    it("hides stale synced entries and tells the server to drop them on the next change", () => {
        settingsState.current = { favoriteModelIds: ["kept", "gone"] }

        const hook = renderFavorites("four", (id) => (id === "gone" ? null : id))
        expect(hook.result.current.favoriteIds).toEqual(["kept"])

        act(() => hook.result.current.toggleFavorite("added"))
        expect(setFavorite).toHaveBeenCalledWith({
            kind: "model",
            id: "added",
            isFavorite: true,
            seed: ["kept"],
            replacements: [{ from: "gone", to: null }]
        })
    })

    it("stops offering additions at the cap", () => {
        settingsState.current = {
            favoriteModelIds: Array.from({ length: 20 }, (_, index) => `model-${index}`)
        }

        const hook = renderFavorites("five")
        act(() => hook.result.current.toggleFavorite("extra"))

        expect(hook.result.current.canAddFavorite).toBe(false)
        expect(setFavorite).not.toHaveBeenCalled()
    })
})
