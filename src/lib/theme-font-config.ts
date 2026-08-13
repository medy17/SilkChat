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

// These are T3 Code's measured T3 Chat product roles, not a generic shadcn
// palette. Keep the role names here so each value is mapped to the equivalent
// SilkChat surface below instead of matching tokens by color or by position.
const T3_CHAT_LIGHT_PALETTE = {
    canvas: "#fdf7fd",
    surface: "#faf3fb",
    surfaceRaised: "#fdfafd",
    surfaceOverlay: "#ffffff",
    text: "#501854",
    messageAction: "#db2777",
    messageActionForeground: "#ffffff",
    secondary: "#f1c4e6",
    secondaryForeground: "#77347c",
    muted: "#eaa7cb",
    mutedForeground: "#8d1255",
    accentSurface: "#f3e6f5",
    accentSurfaceForeground: "#454554",
    error: "#f7086c",
    errorForeground: "#9d174d",
    border: "#eee1ed",
    input: "#e7c1dc",
    focus: "#db2777",
    messageSurface: "#f7def2",
    messageForeground: "#492c61",
    codeBackground: "#f5ecf9",
    codeForeground: "#673c8b",
    sidebar: "#f2e1f4",
    sidebarForeground: "#454554",
    sidebarRowHover: "#f8f8f7",
    sidebarBorder: "#eceae9"
} as const

const T3_CHAT_DARK_PALETTE = {
    canvas: "#1f1a24",
    surface: "#29232d",
    surfaceRaised: "#2c2631",
    surfaceOverlay: "#100a0e",
    text: "#f9f8fb",
    messageAction: "#a3004c",
    messageActionForeground: "#fbd0e8",
    secondary: "#362d3d",
    secondaryForeground: "#d4c7e1",
    muted: "#423a45",
    mutedForeground: "#e7d0dd",
    accentSurface: "#463753",
    accentSurfaceForeground: "#f8f1f5",
    error: "#9d174d",
    errorForeground: "#fbd0e8",
    border: "#27242c",
    input: "#302029",
    focus: "#db2777",
    messageSurface: "#2b2431",
    messageForeground: "#f2ebfa",
    codeBackground: "#1f1a24",
    codeForeground: "#d8c3ef",
    sidebar: "#171018",
    sidebarForeground: "#f4f4f5",
    sidebarRowHover: "#261922",
    sidebarBorder: "#322028"
} as const

export const BUILT_IN_THEME_OVERRIDES = {
    [T3_CHAT_THEME_URL]: {
        theme: {
            "font-sans": LOCAL_THEME_FONTS.proximaVara.stack
        },
        light: {
            background: T3_CHAT_LIGHT_PALETTE.canvas,
            foreground: T3_CHAT_LIGHT_PALETTE.text,
            card: T3_CHAT_LIGHT_PALETTE.surface,
            "card-foreground": T3_CHAT_LIGHT_PALETTE.text,
            popover: T3_CHAT_LIGHT_PALETTE.surfaceOverlay,
            "popover-foreground": T3_CHAT_LIGHT_PALETTE.text,
            primary: T3_CHAT_LIGHT_PALETTE.messageAction,
            "primary-foreground": T3_CHAT_LIGHT_PALETTE.messageActionForeground,
            secondary: T3_CHAT_LIGHT_PALETTE.secondary,
            "secondary-foreground": T3_CHAT_LIGHT_PALETTE.secondaryForeground,
            muted: T3_CHAT_LIGHT_PALETTE.muted,
            "muted-foreground": T3_CHAT_LIGHT_PALETTE.mutedForeground,
            accent: T3_CHAT_LIGHT_PALETTE.accentSurface,
            "accent-foreground": T3_CHAT_LIGHT_PALETTE.accentSurfaceForeground,
            destructive: T3_CHAT_LIGHT_PALETTE.error,
            "destructive-foreground": T3_CHAT_LIGHT_PALETTE.errorForeground,
            border: T3_CHAT_LIGHT_PALETTE.border,
            input: T3_CHAT_LIGHT_PALETTE.input,
            ring: T3_CHAT_LIGHT_PALETTE.focus,
            composer: T3_CHAT_LIGHT_PALETTE.surfaceRaised,
            "user-message": T3_CHAT_LIGHT_PALETTE.messageSurface,
            "user-message-foreground": T3_CHAT_LIGHT_PALETTE.messageForeground,
            "code-background": T3_CHAT_LIGHT_PALETTE.codeBackground,
            "code-foreground": T3_CHAT_LIGHT_PALETTE.codeForeground,
            sidebar: T3_CHAT_LIGHT_PALETTE.sidebar,
            "sidebar-foreground": T3_CHAT_LIGHT_PALETTE.sidebarForeground,
            "sidebar-primary": T3_CHAT_LIGHT_PALETTE.messageAction,
            "sidebar-primary-foreground": T3_CHAT_LIGHT_PALETTE.messageActionForeground,
            "sidebar-accent": T3_CHAT_LIGHT_PALETTE.sidebarRowHover,
            "sidebar-accent-foreground": T3_CHAT_LIGHT_PALETTE.sidebarForeground,
            "sidebar-border": T3_CHAT_LIGHT_PALETTE.sidebarBorder,
            "sidebar-ring": T3_CHAT_LIGHT_PALETTE.focus
        },
        dark: {
            background: T3_CHAT_DARK_PALETTE.canvas,
            foreground: T3_CHAT_DARK_PALETTE.text,
            card: T3_CHAT_DARK_PALETTE.surface,
            "card-foreground": T3_CHAT_DARK_PALETTE.text,
            popover: T3_CHAT_DARK_PALETTE.surfaceOverlay,
            "popover-foreground": T3_CHAT_DARK_PALETTE.text,
            primary: T3_CHAT_DARK_PALETTE.messageAction,
            "primary-foreground": T3_CHAT_DARK_PALETTE.messageActionForeground,
            secondary: T3_CHAT_DARK_PALETTE.secondary,
            "secondary-foreground": T3_CHAT_DARK_PALETTE.secondaryForeground,
            muted: T3_CHAT_DARK_PALETTE.muted,
            "muted-foreground": T3_CHAT_DARK_PALETTE.mutedForeground,
            accent: T3_CHAT_DARK_PALETTE.accentSurface,
            "accent-foreground": T3_CHAT_DARK_PALETTE.accentSurfaceForeground,
            destructive: T3_CHAT_DARK_PALETTE.error,
            "destructive-foreground": T3_CHAT_DARK_PALETTE.errorForeground,
            border: T3_CHAT_DARK_PALETTE.border,
            input: T3_CHAT_DARK_PALETTE.input,
            ring: T3_CHAT_DARK_PALETTE.focus,
            composer: T3_CHAT_DARK_PALETTE.surfaceRaised,
            "user-message": T3_CHAT_DARK_PALETTE.messageSurface,
            "user-message-foreground": T3_CHAT_DARK_PALETTE.messageForeground,
            "code-background": T3_CHAT_DARK_PALETTE.codeBackground,
            "code-foreground": T3_CHAT_DARK_PALETTE.codeForeground,
            sidebar: T3_CHAT_DARK_PALETTE.sidebar,
            "sidebar-foreground": T3_CHAT_DARK_PALETTE.sidebarForeground,
            "sidebar-primary": T3_CHAT_DARK_PALETTE.messageAction,
            "sidebar-primary-foreground": T3_CHAT_DARK_PALETTE.messageActionForeground,
            "sidebar-accent": T3_CHAT_DARK_PALETTE.sidebarRowHover,
            "sidebar-accent-foreground": T3_CHAT_DARK_PALETTE.sidebarForeground,
            "sidebar-border": T3_CHAT_DARK_PALETTE.sidebarBorder,
            "sidebar-ring": T3_CHAT_DARK_PALETTE.focus
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
