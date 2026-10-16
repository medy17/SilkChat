import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { applyThemeToElement } from "@/lib/apply-theme"
import { applyGlassSettings, useGlassSettingsStore } from "@/lib/glass-settings-store"
import { loadThemeFonts } from "@/lib/theme-font-loader"
import { isDefaultThemeCssVars, useThemeStore } from "@/lib/theme-store"
import { useEffect, useState } from "react"

type ThemeProviderProps = {
    children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const { themeState, selectedThemeUrl } = useThemeStore()
    const resolvedMode = useResolvedThemeMode(themeState.currentMode)
    const glassEnabled = useGlassSettingsStore((state) => state.enabled)
    const glassIntensity = useGlassSettingsStore((state) => state.intensity)
    const [isClient, setIsClient] = useState(false)

    // Handle hydration and initialize CSS transitions
    useEffect(() => {
        setIsClient(true)
    }, [])

    useEffect(() => {
        if (!isClient) return

        const root = document.documentElement
        if (!root) return

        applyThemeToElement(themeState, root, resolvedMode, {
            isDefaultTheme: selectedThemeUrl === null && isDefaultThemeCssVars(themeState.cssVars)
        })
        loadThemeFonts(themeState, resolvedMode)
    }, [themeState, selectedThemeUrl, resolvedMode, isClient])

    useEffect(() => {
        if (!isClient) return

        applyGlassSettings(document.documentElement, {
            enabled: glassEnabled,
            intensity: glassIntensity
        })
    }, [glassEnabled, glassIntensity, isClient])

    return <>{children}</>
}
