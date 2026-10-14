import { LOCAL_THEME_FONTS } from "@/lib/theme-font-config"
import { SILK_APP_THEME_COLORS, type SilkAppFont, type SilkAppTheme } from "./protocol"

// Set by scripts/silk-app-runtime-plugin.ts; absent under Vitest.
declare const __SILK_APP_RUNTIME_VERSION__: string | undefined

/** Runtime assets, built by scripts/build-silk-app-runtime.mjs into public/. */
const SILK_APP_RUNTIME_PATH = `/silk-app/${
    typeof __SILK_APP_RUNTIME_VERSION__ === "string" ? __SILK_APP_RUNTIME_VERSION__ : "dev"
}`

// Success borrows the host's affordable-cost green; every other variable keeps its name.
const HOST_VARIABLES: Readonly<Record<string, string>> = { success: "--model-cost-affordable" }

// [frame variable, host variable].
const THEME_VARS: ReadonlyArray<readonly [string, string]> = [
    ...SILK_APP_THEME_COLORS,
    "radius",
    "font-sans",
    "font-serif",
    "font-mono",
    "shadow-2xs",
    "shadow-xs",
    "shadow-sm",
    "shadow",
    "shadow-md",
    "shadow-lg",
    "shadow-xl",
    "shadow-2xl",
    "tracking-normal"
].map((name) => [name, HOST_VARIABLES[name] ?? `--${name}`] as const)

export const readSilkAppTheme = (): SilkAppTheme => {
    const root = document.documentElement
    const styles = getComputedStyle(root)
    const vars: Record<string, string> = {}
    for (const [name, source] of THEME_VARS) {
        const value = styles.getPropertyValue(source).trim()
        if (value) vars[name] = value
    }

    return {
        vars,
        dark: root.classList.contains("dark"),
        rootFontSize: styles.fontSize,
        fontStylesheets: Array.from(
            document.querySelectorAll<HTMLLinkElement>(
                'link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]'
            ),
            (link) => link.href
        )
    }
}

let localFonts: Promise<SilkAppFont[]> | null = null

/** Self-hosted theme fonts as bytes; an opaque-origin frame can't fetch them itself. */
export const loadSilkAppFonts = () => {
    localFonts ??= Promise.all(
        Object.values(LOCAL_THEME_FONTS).flatMap((font) =>
            font.sources.map(async (source) => {
                const response = await fetch(source.path)
                if (!response.ok) throw new Error(`Failed to load ${source.path}`)
                return {
                    family: font.family,
                    data: await response.arrayBuffer(),
                    weight: font.weight,
                    style: font.style
                }
            })
        )
    ).catch(() => {
        localFonts = null
        return []
    })
    return localFonts
}

// Apps run offline: scripts come only from the runtime (plus the evaluator's eval), and
// nothing can fetch, submit, or load from elsewhere, so model code can't send data out.
// Theme fonts are the one exception. Form submit events still reach React handlers.
const buildContentSecurityPolicy = (origin: string) =>
    [
        "default-src 'none'",
        `script-src ${origin}${SILK_APP_RUNTIME_PATH}/ 'unsafe-eval'`,
        "style-src 'unsafe-inline' https://fonts.googleapis.com",
        "font-src data: https://fonts.gstatic.com",
        "img-src data: blob:",
        "media-src data: blob:",
        "connect-src 'none'",
        "form-action 'none'",
        "base-uri 'none'"
    ].join("; ")

export const buildSilkAppDocument = (origin: string) => {
    const base = `${origin}${SILK_APP_RUNTIME_PATH}`
    return `<!doctype html>
<html data-mode="inline">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${buildContentSecurityPolicy(origin)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="${base}/tailwind.js"></script>
<script src="${base}/runtime.js"></script>
</head>
<body><div id="root"></div></body>
</html>`
}
