import {
    type PrivateViewingOverride,
    getIsImageHidden,
    getNextPrivateViewingOverride
} from "@/lib/private-viewing"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export const PRIVATE_VIEWING_STORE_KEY = "library-private-viewing-store"

interface PrivateViewingStore {
    privateViewingEnabled: boolean
    imageOverrides: Record<string, PrivateViewingOverride>
    setPrivateViewingEnabled: (enabled: boolean) => void
    togglePrivateViewingEnabled: () => void
    toggleImageVisibility: (imageId: string) => void
    isImageHidden: (imageId: string) => boolean
}

export const usePrivateViewingStore = create<PrivateViewingStore>()(
    persist(
        (set, get) => ({
            privateViewingEnabled: false,
            imageOverrides: {},
            setPrivateViewingEnabled: (enabled) =>
                set({
                    privateViewingEnabled: enabled,
                    imageOverrides: {}
                }),
            togglePrivateViewingEnabled: () =>
                set((state) => ({
                    privateViewingEnabled: !state.privateViewingEnabled,
                    imageOverrides: {}
                })),
            toggleImageVisibility: (imageId) =>
                set((state) => {
                    const nextOverride = getNextPrivateViewingOverride({
                        privateViewingEnabled: state.privateViewingEnabled,
                        override: state.imageOverrides[imageId]
                    })
                    const nextOverrides = { ...state.imageOverrides }

                    if (nextOverride) {
                        nextOverrides[imageId] = nextOverride
                    } else {
                        delete nextOverrides[imageId]
                    }

                    return {
                        imageOverrides: nextOverrides
                    }
                }),
            isImageHidden: (imageId) =>
                getIsImageHidden({
                    privateViewingEnabled: get().privateViewingEnabled,
                    override: get().imageOverrides[imageId]
                })
        }),
        {
            name: PRIVATE_VIEWING_STORE_KEY,
            partialize: (state) => ({
                privateViewingEnabled: state.privateViewingEnabled,
                imageOverrides: state.imageOverrides
            })
        }
    )
)
