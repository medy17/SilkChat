import { getNextThemeMode } from "./theme-mode"
import { useThemeStore } from "./theme-store"

export const toggleThemeMode = () => {
    const themeState = useThemeStore.getState().themeState
    const newMode = getNextThemeMode(themeState.currentMode)

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (!document.startViewTransition || prefersReducedMotion) {
        useThemeStore.getState().setThemeState({
            ...themeState,
            currentMode: newMode
        })
        return
    }

    document.startViewTransition(() => {
        useThemeStore.getState().setThemeState({
            ...themeState,
            currentMode: newMode
        })
    })
}
