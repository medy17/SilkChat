import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { applyThemeToElement } from "@/lib/apply-theme"
import { loadThemeFonts } from "@/lib/theme-font-loader"
import { isDefaultThemeCssVars, useThemeStore } from "@/lib/theme-store"
import { useEffect, useState } from "react"

type ThemeProviderProps = {
    children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const { themeState, selectedThemeUrl } = useThemeStore()
    const resolvedMode = useResolvedThemeMode(themeState.currentMode)
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
            isDefaultTheme:
                selectedThemeUrl === null && isDefaultThemeCssVars(themeState.cssVars)
        })
        loadThemeFonts(themeState, resolvedMode)
    }, [themeState, selectedThemeUrl, resolvedMode, isClient])

    return <>{children}</>
}
