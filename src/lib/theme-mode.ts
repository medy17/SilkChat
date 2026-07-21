export type ResolvedThemeMode = "light" | "dark"
export type ThemeMode = ResolvedThemeMode | "system"

const THEME_MODE_CYCLE: ThemeMode[] = ["system", "light", "dark"]

export function getSystemThemeMode(): ResolvedThemeMode {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "light"
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
    return mode === "system" ? getSystemThemeMode() : mode
}

export function getNextThemeMode(mode: ThemeMode): ThemeMode {
    const currentIndex = THEME_MODE_CYCLE.indexOf(mode)
    return THEME_MODE_CYCLE[(currentIndex + 1) % THEME_MODE_CYCLE.length]
}
