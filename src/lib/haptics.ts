import { type HapticInput, type Vibration, WebHaptics } from "web-haptics"
import { useHapticsSettingsStore } from "./haptics-settings-store"

let haptics: WebHaptics | undefined

export const RESPONSE_START_PATTERN: Vibration[] = Array.from({ length: 30 }, (_, index) => {
    const progress = index / 29
    return {
        ...(index === 0 ? {} : { delay: Math.round(32 + 120 * progress ** 1.7) }),
        duration: Math.round(52 - 42 * progress),
        intensity: 0.98 * (1 - progress) ** 1.55
    }
})

export const RESPONSE_COMPLETE_PATTERN: Vibration[] = [
    { duration: 12, intensity: 1 },
    { delay: 8, duration: 10, intensity: 0.72 },
    { delay: 8, duration: 8, intensity: 0.45 },
    { delay: 8, duration: 6, intensity: 0.2 },
    { delay: 600, duration: 18, intensity: 1 }
]

const getHaptics = () => {
    if (typeof window === "undefined") return undefined

    haptics ??= new WebHaptics()
    return haptics
}

export const playHapticPattern = (pattern: HapticInput) => {
    if (!useHapticsSettingsStore.getState().enabled) return
    void getHaptics()?.trigger(pattern)
}

export const stopHaptics = () => {
    haptics?.cancel()
}

export const playResponseStartHaptic = () => {
    playHapticPattern(RESPONSE_START_PATTERN)
}

export const playResponseCompleteHaptic = () => {
    stopHaptics()
    playHapticPattern(RESPONSE_COMPLETE_PATTERN)
}

export const playExpandedImageDismissHaptic = () => {
    playHapticPattern("light")
}
