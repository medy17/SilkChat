import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { applyThemeToElement } from "@/lib/apply-theme"
import { loadThemeFonts } from "@/lib/theme-font-loader"
import { useThemeStore } from "@/lib/theme-store"
import { useEffect, useState } from "react"

type ThemeProviderProps = {
    children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const { themeState } = useThemeStore()
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

        applyThemeToElement(themeState, root, resolvedMode)
        loadThemeFonts(themeState, resolvedMode)
    }, [themeState, resolvedMode, isClient])

    return <>{children}</>
}
