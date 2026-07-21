import { type ResolvedThemeMode, type ThemeMode, resolveThemeMode } from "@/lib/theme-mode"

type ThemeState = {
    currentMode: ThemeMode
    cssVars: {
        theme: Record<string, string>
        light: Record<string, string>
        dark: Record<string, string>
    }
}

export function applyThemeToElement(
    themeState: ThemeState,
    element: HTMLElement,
    resolvedMode: ResolvedThemeMode = resolveThemeMode(themeState.currentMode)
) {
    if (!element) return

    // Apply base theme variables
    Object.entries(themeState.cssVars.theme).forEach(([key, value]) => {
        element.style.setProperty(`--${key}`, value)
    })

    // Apply mode-specific variables
    const modeVars = themeState.cssVars[resolvedMode]
    Object.entries(modeVars).forEach(([key, value]) => {
        if (key in themeState.cssVars.theme) {
            return
        }

        element.style.setProperty(`--${key}`, value)
    })

    // Update data attribute for CSS selectors
    element.setAttribute("data-theme", resolvedMode)
    element.setAttribute("data-theme-mode", themeState.currentMode)

    // Update class for compatibility with existing theme systems
    if (resolvedMode === "dark") {
        element.classList.add("dark")
        element.classList.remove("light")
    } else {
        element.classList.add("light")
        element.classList.remove("dark")
    }
}
