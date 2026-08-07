import { z } from "zod"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export const HAPTICS_SETTINGS_STORE_KEY = "haptics-settings-store"

type HapticsSettingsStore = {
    enabled: boolean
    setEnabled: (enabled: boolean) => void
}

const PersistedHapticsSettingsSchema = z.object({
    enabled: z.boolean().optional()
})

export const useHapticsSettingsStore = create<HapticsSettingsStore>()(
    persist(
        (set) => ({
            enabled: true,
            setEnabled: (enabled) => set({ enabled })
        }),
        {
            name: HAPTICS_SETTINGS_STORE_KEY,
            partialize: (state) => ({ enabled: state.enabled }),
            merge: (persistedState, currentState) => {
                const parsed = PersistedHapticsSettingsSchema.safeParse(persistedState)
                if (!parsed.success) return currentState

                return {
                    ...currentState,
                    ...parsed.data
                }
            }
        }
    )
)
