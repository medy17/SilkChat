export const T3_CHAT_THEME_URL = "https://tweakcn.com/editor/theme?theme=t3-chat"

type ThemeCssVars = {
    theme: Record<string, string>
    light: Record<string, string>
    dark: Record<string, string>
}

export type ThemePresetLike = {
    cssVars: ThemeCssVars
}

type LocalThemeFontSource = {
    path: string
    format: string
    mimeType: string
}

type LocalThemeFontDefinition = {
    family: string
    stack: string
    sources: LocalThemeFontSource[]
    display: string
    weight: string
    style: string
}

type ThemeOverrideTokens = Record<string, string>

type BuiltInThemeOverride = Partial<Record<keyof ThemeCssVars, ThemeOverrideTokens>>

export const LOCAL_THEME_FONTS = {
    proximaVara: {
        family: "ProximaVara",
        stack: '"ProximaVara", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        sources: [
            {
                path: "/fonts/proxima-vara.woff2",
                format: "woff2",
                mimeType: "font/woff2"
            }
        ],
        display: "swap",
        weight: "200 800",
        style: "normal"
    }
} as const satisfies Record<string, LocalThemeFontDefinition>

export const DEFAULT_THEME_SANS_FONT_STACK = LOCAL_THEME_FONTS.proximaVara.stack

export const DEFAULT_THEME_MONO_FONT_STACK =
    '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

export const DEFAULT_THEME_SERIF_FONT_STACK = 'Georgia, Cambria, "Times New Roman", Times, serif'

// Weight/italic axes for the Google Fonts css2 API, per family the built-in
// tweakcn themes reference. Loaded on demand when a theme uses the family —
// there is no upfront stylesheet covering all of them. Keys are lowercase.
// Families not listed here are requested at weight 400 only.
export const GOOGLE_THEME_FONT_AXES: Record<string, string> = {
    "architects daughter": "",
    "dm sans": "ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000",
    "fira code": "wght@300..700",
    geist: "wght@100..900",
    "geist mono": "wght@100..900",
    "ibm plex mono":
        "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700",
    "ibm plex sans": "ital,wght@0,100..700;1,100..700",
    inter: "ital,opsz,wght@0,14..32,100..900;1,14..32,100..900",
    "jetbrains mono": "ital,wght@0,100..800;1,100..800",
    "libre baskerville": "ital,wght@0,400;0,700;1,400",
    lora: "ital,wght@0,400..700;1,400..700",
    merriweather: "ital,opsz,wght@0,18..144,300..900;1,18..144,300..900",
    montserrat: "ital,wght@0,100..900;1,100..900",
    "open sans": "ital,wght@0,300..800;1,300..800",
    outfit: "wght@100..900",
    oxanium: "wght@200..800",
    "playfair display": "ital,wght@0,400..900;1,400..900",
    "plus jakarta sans": "ital,wght@0,200..800;1,200..800",
    poppins:
        "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900",
    roboto: "ital,wght@0,100..900;1,100..900",
    "roboto mono": "ital,wght@0,100..700;1,100..700",
    "source code pro": "ital,wght@0,200..900;1,200..900",
    "source serif 4": "ital,opsz,wght@0,8..60,200..900;1,8..60,200..900",
    "space grotesk": "wght@300..700",
    "space mono": "ital,wght@0,400;0,700;1,400;1,700"
}

// Web-safe families that ship with the OS — never fetch these from Google
// Fonts. Lowercase, matched against the first family in a font stack.
export const WEB_SAFE_FONT_FAMILY_NAMES = [
    "arial",
    "arial black",
    "cambria",
    "courier",
    "courier new",
    "garamond",
    "georgia",
    "helvetica",
    "helvetica neue",
    "palatino",
    "segoe ui",
    "tahoma",
    "times",
    "times new roman",
    "trebuchet ms",
    "verdana"
]

export const BUILT_IN_THEME_OVERRIDES = {
    [T3_CHAT_THEME_URL]: {
        theme: {
            "font-sans": LOCAL_THEME_FONTS.proximaVara.stack
        },
        light: {
            foreground: "#492c61",
            "card-foreground": "#492c61",
            "popover-foreground": "#492c61",
            primary: "#da006b",
            "primary-foreground": "#ffffff",
            "secondary-foreground": "#563271",
            "muted-foreground": "#7b44ab",
            "accent-foreground": "#563271",
            border: "#d8c3ef",
            input: "#d8c3ef",
            ring: "#da006b",
            "sidebar-foreground": "#492c61",
            "sidebar-primary": "#da006b",
            "sidebar-primary-foreground": "#ffffff",
            "sidebar-accent-foreground": "#563271",
            "sidebar-border": "#d8c3ef"
        },
        dark: {
            foreground: "#f2ebfa",
            "card-foreground": "#f2ebfa",
            "popover-foreground": "#faf7fd",
            primary: "#f472b6",
            "primary-foreground": "#492c61",
            "secondary-foreground": "#f2ebfa",
            "muted-foreground": "#bf9be4",
            "accent-foreground": "#faf7fd",
            border: "#463854",
            input: "#6d5d7f",
            ring: "#f472b6",
            "sidebar-foreground": "#f2ebfa",
            "sidebar-primary": "#f472b6",
            "sidebar-primary-foreground": "#492c61",
            "sidebar-accent-foreground": "#faf7fd",
            "sidebar-border": "#463854"
        }
    }
} as const satisfies Record<string, BuiltInThemeOverride>

export const LOCAL_THEME_FONT_FAMILY_NAMES = Object.values(LOCAL_THEME_FONTS).map(
    (font) => font.family
)

export const LOCAL_THEME_FONT_PRELOADS = Object.values(LOCAL_THEME_FONTS).flatMap((font) =>
    font.sources.map((source) => ({
        href: source.path,
        type: source.mimeType
    }))
)

function applyOverrideTokens(
    section: Record<string, string>,
    tokens?: ThemeOverrideTokens
): Record<string, string> {
    if (!tokens) {
        return section
    }

    return {
        ...section,
        ...tokens
    }
}

export function applyBuiltInThemeOverrides<T extends ThemePresetLike>(url: string, preset: T): T {
    const override = (BUILT_IN_THEME_OVERRIDES as Record<string, BuiltInThemeOverride>)[url]
    if (!override) {
        return preset
    }

    return {
        ...preset,
        cssVars: {
            theme: applyOverrideTokens(preset.cssVars.theme, override.theme),
            light: applyOverrideTokens(preset.cssVars.light, override.light),
            dark: applyOverrideTokens(preset.cssVars.dark, override.dark)
        }
    }
}

export function getLocalThemeFontFaceCss() {
    return Object.values(LOCAL_THEME_FONTS)
        .map((font) => {
            const src = font.sources
                .map((source) => `url("${source.path}") format("${source.format}")`)
                .join(", ")

            return [
                "@font-face {",
                `    font-family: "${font.family}";`,
                `    src: ${src};`,
                `    font-style: ${font.style};`,
                `    font-weight: ${font.weight};`,
                `    font-display: ${font.display};`,
                "}"
            ].join("\n")
        })
        .join("\n\n")
}
