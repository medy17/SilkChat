import { type ThemeMode, getSystemThemeMode, resolveThemeMode } from "@/lib/theme-mode"
import { useEffect, useState } from "react"

export function useResolvedThemeMode(mode: ThemeMode) {
    const [resolvedMode, setResolvedMode] = useState(() => resolveThemeMode(mode))

    useEffect(() => {
        if (mode !== "system") {
            setResolvedMode(mode)
            return
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        const updateResolvedMode = () => setResolvedMode(getSystemThemeMode())

        updateResolvedMode()
        mediaQuery.addEventListener("change", updateResolvedMode)
        return () => mediaQuery.removeEventListener("change", updateResolvedMode)
    }, [mode])

    return resolvedMode
}
