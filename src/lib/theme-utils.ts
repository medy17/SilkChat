import { T3_CHAT_THEME_URL, applyBuiltInThemeOverrides } from "@/lib/theme-font-config"

export const THEME_URLS = [
    "https://tweakcn.com/themes/cmrzdtil2000704jldxp75mdg",
    "https://tweakcn.com/themes/cmndaz3pj000604js33fr1gsk",
    T3_CHAT_THEME_URL,
    "https://tweakcn.com/editor/theme?theme=tangerine",
    "https://tweakcn.com/editor/theme?theme=perpetuity",
    "https://tweakcn.com/editor/theme?theme=modern-minimal",
    "https://tweakcn.com/r/themes/vintage-paper.json",
    "https://tweakcn.com/r/themes/amethyst-haze.json",
    "https://tweakcn.com/editor/theme?theme=caffeine",
    "https://tweakcn.com/themes/cmmdxhg6d000804l5f6xlcbh3",
    "https://tweakcn.com/editor/theme?theme=vercel"
]

export type ThemePreset = {
    cssVars: {
        theme: Record<string, string>
        light: Record<string, string>
        dark: Record<string, string>
    }
}

export type FetchedTheme = {
    name: string
    preset: ThemePreset
    url: string
    error?: string
    type: "custom" | "built-in"
}

type ExternalTheme = {
    name?: string
    cssVars?: {
        theme?: Record<string, string>
        light?: Record<string, string>
        dark?: Record<string, string>
    }
}

export function convertToThemePreset(externalTheme: ExternalTheme): ThemePreset {
    if (externalTheme.cssVars) {
        return {
            cssVars: {
                theme: externalTheme.cssVars.theme || {},
                light: externalTheme.cssVars.light || {},
                dark: externalTheme.cssVars.dark || {}
            }
        }
    }

    throw new Error("Unsupported theme format")
}

export function getThemeName(themeData: ExternalTheme, url: string): string {
    if (themeData.name) {
        return themeData.name.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    }

    return "Custom Theme"
}

const THEME_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/

export function normalizeThemeImportUrl(value: string): string | null {
    try {
        const parsedUrl = new URL(value.trim())
        if (
            parsedUrl.origin !== "https://tweakcn.com" ||
            parsedUrl.username ||
            parsedUrl.password ||
            parsedUrl.hash
        ) {
            return null
        }

        const themePathMatch = parsedUrl.pathname.match(/^\/themes\/([A-Za-z0-9_-]+)$/)
        if (themePathMatch && !parsedUrl.search) {
            return `https://tweakcn.com/themes/${themePathMatch[1]}`
        }

        if (parsedUrl.pathname !== "/editor/theme") return null

        const themeId = parsedUrl.searchParams.get("theme")
        const queryKeys = Array.from(parsedUrl.searchParams.keys())
        if (
            !themeId ||
            !THEME_IDENTIFIER_PATTERN.test(themeId) ||
            queryKeys.length !== 1 ||
            queryKeys[0] !== "theme"
        ) {
            return null
        }

        return `https://tweakcn.com/editor/theme?theme=${themeId}`
    } catch {
        return null
    }
}

export function getThemeResourceUrl(url: string): string {
    try {
        const parsedUrl = new URL(url)
        if (parsedUrl.origin !== "https://tweakcn.com") return url

        if (parsedUrl.pathname === "/editor/theme") {
            const themeId = parsedUrl.searchParams.get("theme")
            if (themeId) return `https://tweakcn.com/r/themes/${themeId}.json`
        }

        if (parsedUrl.pathname.startsWith("/themes/")) {
            return `https://tweakcn.com/r${parsedUrl.pathname}`
        }

        parsedUrl.hash = ""
        return parsedUrl.toString()
    } catch {
        return url
    }
}

export function getBuiltInThemeUrl(url: string): string | undefined {
    const resourceUrl = getThemeResourceUrl(url)
    return THEME_URLS.find((builtInUrl) => getThemeResourceUrl(builtInUrl) === resourceUrl)
}

export function isMissingImportedThemeSelection(
    selectedThemeUrl: string | null,
    importedThemeUrls: readonly string[],
    localThemeUrls: readonly string[] = []
): boolean {
    return Boolean(
        selectedThemeUrl &&
            !getBuiltInThemeUrl(selectedThemeUrl) &&
            !localThemeUrls.includes(selectedThemeUrl) &&
            !importedThemeUrls.includes(selectedThemeUrl)
    )
}

export async function fetchThemeFromUrl(url: string): Promise<FetchedTheme> {
    const transformedUrl = getThemeResourceUrl(url)

    try {
        const response = await fetch(transformedUrl)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const themeData = await response.json()
        const builtInThemeUrl = getBuiltInThemeUrl(url)
        const themePreset = applyBuiltInThemeOverrides(
            builtInThemeUrl ?? url,
            convertToThemePreset(themeData)
        )
        const themeName = getThemeName(themeData, url)
        return {
            name: themeName,
            preset: themePreset,
            url,
            type: builtInThemeUrl ? "built-in" : "custom"
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch theme"
        return {
            name: getThemeName({}, url),
            preset: { cssVars: { theme: {}, light: {}, dark: {} } },
            url,
            error: errorMessage,
            type: getBuiltInThemeUrl(url) ? "built-in" : "custom"
        }
    }
}

export function extractThemeColors(preset: ThemePreset, mode: "light" | "dark"): string[] {
    const colors: string[] = []
    const { light, dark, theme } = preset.cssVars
    const modeVars = mode === "light" ? light : dark

    const colorKeys = [
        "primary",
        "accent",
        "secondary",
        "background",
        "muted",
        "destructive",
        "border",
        "card",
        "popover"
    ]

    const currentVars = { ...theme, ...modeVars }

    colorKeys.forEach((key) => {
        const colorValue = currentVars[key]
        if (colorValue && colors.length < 5) {
            if (colorValue.includes("hsl")) {
                colors.push(`hsl(${colorValue})`)
            } else {
                colors.push(colorValue)
            }
        }
    })

    return colors.slice(0, 5)
}
