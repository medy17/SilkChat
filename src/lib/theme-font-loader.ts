import {
    GOOGLE_THEME_FONT_AXES,
    LOCAL_THEME_FONT_FAMILY_NAMES,
    WEB_SAFE_FONT_FAMILY_NAMES
} from "@/lib/theme-font-config"

const DEFAULT_FONT_AXES = "wght@400"

const SYSTEM_FONTS = new Set([
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
    "system-ui",
    "sans-serif",
    "serif",
    "monospace",
    "cursive",
    "fantasy",
    ...WEB_SAFE_FONT_FAMILY_NAMES
])

const LOCAL_FONTS = new Set(LOCAL_THEME_FONT_FAMILY_NAMES.map((family) => family.toLowerCase()))

type ThemeMode = "dark" | "light"

type ThemeState = {
    currentMode: ThemeMode
    cssVars: {
        theme: Record<string, string>
        light: Record<string, string>
        dark: Record<string, string>
    }
}

function extractFontFamily(fontFamilyValue?: string | null) {
    if (!fontFamilyValue) return null

    const firstFont = fontFamilyValue.split(",")[0]?.trim()
    if (!firstFont) return null

    const cleanFont = firstFont.replace(/['"]/g, "")
    const normalizedFont = cleanFont.toLowerCase()
    if (SYSTEM_FONTS.has(normalizedFont) || LOCAL_FONTS.has(normalizedFont)) {
        return null
    }

    return cleanFont
}

function buildFontCssUrl(family: string) {
    const normalizedFamily = family.trim().replace(/\s+/g, "+")
    const axes = GOOGLE_THEME_FONT_AXES[family.trim().toLowerCase()] ?? DEFAULT_FONT_AXES
    const familyParam = axes ? `${normalizedFamily}:${axes}` : normalizedFamily
    return `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`
}

function ensureFontStylesheet(family: string) {
    const href = buildFontCssUrl(family)
    const existing = document.querySelector(
        `link[data-theme-font="${family}"], link[href="${href}"]`
    )
    if (existing) return

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = href
    link.setAttribute("data-theme-font", family)
    document.head.appendChild(link)
}

export function loadThemeFonts(themeState: ThemeState) {
    if (typeof document === "undefined") return

    const modeVars = themeState.cssVars[themeState.currentMode]
    const activeFontVars = {
        ...themeState.cssVars.theme,
        ...modeVars
    }

    const fontValues = [
        activeFontVars["font-sans"],
        activeFontVars["font-serif"],
        activeFontVars["font-mono"]
    ]

    for (const fontValue of fontValues) {
        const family = extractFontFamily(fontValue)
        if (!family) continue
        ensureFontStylesheet(family)
    }
}
