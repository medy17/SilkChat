import { type ResolvedThemeMode, type ThemeMode, resolveThemeMode } from "@/lib/theme-mode"

type ThemeState = {
    currentMode: ThemeMode
    cssVars: {
        theme: Record<string, string>
        light: Record<string, string>
        dark: Record<string, string>
    }
}

export const USER_MESSAGE_FALLBACKS = {
    theme: "var(--secondary)",
    default: {
        light: "color-mix(in oklab, var(--secondary) 50%, transparent)",
        dark: "oklch(0.3132 0 0)"
    }
} as const

export const APP_SURFACE_FALLBACKS = {
    "user-message-foreground": "var(--foreground)",
    composer: {
        light: "color-mix(in oklab, var(--background) 80%, transparent)",
        dark: "var(--sidebar)"
    },
    "code-background": "var(--background)",
    "code-foreground": "var(--foreground)"
} as const

type ApplyThemeOptions = {
    isDefaultTheme?: boolean
}

export function applyThemeToElement(
    themeState: ThemeState,
    element: HTMLElement,
    resolvedMode: ResolvedThemeMode = resolveThemeMode(themeState.currentMode),
    { isDefaultTheme = false }: ApplyThemeOptions = {}
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

    const userMessage =
        modeVars["user-message"] ??
        themeState.cssVars.theme["user-message"] ??
        (isDefaultTheme
            ? USER_MESSAGE_FALLBACKS.default[resolvedMode]
            : USER_MESSAGE_FALLBACKS.theme)
    element.style.setProperty("--user-message", userMessage)

    element.style.setProperty(
        "--user-message-foreground",
        modeVars["user-message-foreground"] ??
            themeState.cssVars.theme["user-message-foreground"] ??
            APP_SURFACE_FALLBACKS["user-message-foreground"]
    )
    element.style.setProperty(
        "--composer",
        modeVars.composer ??
            themeState.cssVars.theme.composer ??
            APP_SURFACE_FALLBACKS.composer[resolvedMode]
    )
    element.style.setProperty(
        "--code-background",
        modeVars["code-background"] ??
            themeState.cssVars.theme["code-background"] ??
            APP_SURFACE_FALLBACKS["code-background"]
    )
    element.style.setProperty(
        "--code-foreground",
        modeVars["code-foreground"] ??
            themeState.cssVars.theme["code-foreground"] ??
            APP_SURFACE_FALLBACKS["code-foreground"]
    )

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
