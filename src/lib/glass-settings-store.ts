import { z } from "zod"
import { create } from "zustand"
import { persist } from "zustand/middleware"

// Per-device, not synced: glass cost and comfort depend on the device.
export const GLASS_SETTINGS_STORE_KEY = "glass-settings-store"

// Scales every role's transparency in src/styles/glass.css. Each step is shown
// as the transparency of floating controls at that intensity.
export const GLASS_INTENSITY_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const
export const DEFAULT_GLASS_INTENSITY = 1
const CONTROL_TRANSPARENCY_AT_DEFAULT = 0.4

export type GlassIntensity = (typeof GLASS_INTENSITY_STEPS)[number]

type GlassSettingsStore = {
    enabled: boolean
    intensity: GlassIntensity
    setEnabled: (enabled: boolean) => void
    setIntensity: (intensity: GlassIntensity) => void
}

const PersistedGlassSettingsSchema = z.object({
    enabled: z.boolean().optional(),
    intensity: z
        .union([z.literal(0.5), z.literal(0.75), z.literal(1), z.literal(1.25), z.literal(1.5)])
        .optional()
})

export const getGlassTransparencyLabel = (intensity: GlassIntensity) =>
    `${Math.round(CONTROL_TRANSPARENCY_AT_DEFAULT * intensity * 100)}%`

export const applyGlassSettings = (
    root: HTMLElement,
    settings: Pick<GlassSettingsStore, "enabled" | "intensity">
) => {
    root.dataset.glass = settings.enabled ? "on" : "off"
    root.style.setProperty("--glass-intensity", String(settings.intensity))
}

export const useGlassSettingsStore = create<GlassSettingsStore>()(
    persist(
        (set) => ({
            enabled: true,
            intensity: DEFAULT_GLASS_INTENSITY,
            setEnabled: (enabled) => set({ enabled }),
            setIntensity: (intensity) => set({ intensity })
        }),
        {
            name: GLASS_SETTINGS_STORE_KEY,
            partialize: (state) => ({ enabled: state.enabled, intensity: state.intensity }),
            merge: (persistedState, currentState) => {
                const parsed = PersistedGlassSettingsSchema.safeParse(persistedState)
                if (!parsed.success) return currentState

                return {
                    ...currentState,
                    ...parsed.data
                }
            }
        }
    )
)

// Runs in <head> before first paint so a device with glass off never flashes it.
export const GLASS_BOOT_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem(${JSON.stringify(GLASS_SETTINGS_STORE_KEY)});
    var state = raw ? JSON.parse(raw).state : null;
    var root = document.documentElement;
    var steps = ${JSON.stringify(GLASS_INTENSITY_STEPS)};
    root.dataset.glass = state && state.enabled === false ? "off" : "on";
    if (state && steps.indexOf(state.intensity) !== -1) {
      root.style.setProperty("--glass-intensity", String(state.intensity));
    }
  } catch (_) {}
})();
`
