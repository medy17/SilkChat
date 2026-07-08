import { create } from "zustand"
import { persist } from "zustand/middleware"

export type DevToolsMode = "user" | "dev"

/** Persisted floating-dock corner. The dock always rests against one of the four corners. */
export type DevDockCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

type DevToolsState = {
    mode: DevToolsMode
    showUtilityDock: boolean
    showContextualDevTools: boolean
    dockCorner: DevDockCorner
    setMode: (mode: DevToolsMode) => void
    setShowUtilityDock: (showUtilityDock: boolean) => void
    setShowContextualDevTools: (showContextualDevTools: boolean) => void
    setDockCorner: (dockCorner: DevDockCorner) => void
}

export const DEV_TOOLS_STORE_KEY = "dev-tools-store"

export const canUseDevTools = () => import.meta.env.DEV

export const useDevToolsStore = create<DevToolsState>()(
    persist(
        (set) => ({
            mode: "user",
            showUtilityDock: true,
            showContextualDevTools: true,
            dockCorner: "bottom-right",
            setMode: (mode) => set({ mode }),
            setShowUtilityDock: (showUtilityDock) => set({ showUtilityDock }),
            setShowContextualDevTools: (showContextualDevTools) => set({ showContextualDevTools }),
            setDockCorner: (dockCorner) => set({ dockCorner })
        }),
        {
            name: DEV_TOOLS_STORE_KEY
        }
    )
)

export const useShowContextualDevTools = () => {
    const mode = useDevToolsStore((state) => state.mode)
    const showContextualDevTools = useDevToolsStore((state) => state.showContextualDevTools)
    return canUseDevTools() && mode === "dev" && showContextualDevTools
}

export type DevStorageScope = "convex" | "model" | "theme" | "credits" | "library" | "all-app-state"

const MODEL_STORAGE_KEYS = ["model-storage"]
const THEME_STORAGE_KEYS = ["theme-store"]
const LIBRARY_STORAGE_KEYS = [
    "library-generation-store",
    "library-private-viewing-store",
    "fal-image-migration-storage-reset:v1"
]

export const getDevStorageKeysForScope = (storage: Storage, scope: DevStorageScope) => {
    const keys = Object.keys(storage)

    switch (scope) {
        case "convex":
            return keys.filter((key) => key.startsWith("CVX_DISK_CACHE:"))
        case "model":
            return keys.filter((key) => MODEL_STORAGE_KEYS.includes(key))
        case "theme":
            return keys.filter((key) => THEME_STORAGE_KEYS.includes(key))
        case "credits":
            return keys.filter((key) => key.startsWith("prototype-credit-"))
        case "library":
            return keys.filter(
                (key) =>
                    LIBRARY_STORAGE_KEYS.includes(key) ||
                    key.startsWith("legacy-image-model-migrated:")
            )
        case "all-app-state": {
            const scopes: DevStorageScope[] = ["convex", "model", "theme", "credits", "library"]
            return Array.from(
                new Set(
                    scopes.flatMap((storageScope) =>
                        getDevStorageKeysForScope(storage, storageScope)
                    )
                )
            )
        }
    }
}

export const clearDevStorageScope = (storage: Storage, scope: DevStorageScope) => {
    const keys = getDevStorageKeysForScope(storage, scope)
    for (const key of keys) {
        storage.removeItem(key)
    }
    return keys
}
