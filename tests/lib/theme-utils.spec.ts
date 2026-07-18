import {
    LOCAL_THEME_FONTS,
    LOCAL_THEME_FONT_PRELOADS,
    T3_CHAT_THEME_URL,
    type ThemePresetLike,
    applyBuiltInThemeOverrides,
    getLocalThemeFontFaceCss
} from "@/lib/theme-font-config"
import { describe, expect, it } from "vitest"

function createPreset(fontSans: string): ThemePresetLike {
    return {
        cssVars: {
            theme: {
                "font-sans": fontSans,
                radius: "0.5rem"
            },
            light: {
                "font-sans": fontSans,
                primary: "oklch(0 0 0)"
            },
            dark: {
                "font-sans": fontSans,
                primary: "oklch(1 0 0)"
            }
        }
    }
}

describe("applyBuiltInThemeOverrides", () => {
    it("maps the t3-chat identity onto the app theme tokens", () => {
        const preset = createPreset("system-ui, sans-serif")

        const result = applyBuiltInThemeOverrides(T3_CHAT_THEME_URL, preset)

        expect(result.cssVars.theme["font-sans"]).toBe(LOCAL_THEME_FONTS.proximaVara.stack)
        expect(result.cssVars.light.primary).toBe("#da006b")
        expect(result.cssVars.light.foreground).toBe("#492c61")
        expect(result.cssVars.light["muted-foreground"]).toBe("#7b44ab")
        expect(result.cssVars.dark.primary).toBe("#f472b6")
        expect(result.cssVars.dark.foreground).toBe("#f2ebfa")
        expect(result.cssVars.dark.border).toBe("#463854")
        expect(result.cssVars.theme.radius).toBe("0.5rem")
    })

    it("leaves other themes untouched", () => {
        const preset = createPreset("Geist Mono, monospace")

        const result = applyBuiltInThemeOverrides(
            "https://tweakcn.com/editor/theme?theme=mono",
            preset
        )

        expect(result).toEqual(preset)
    })

    it("exposes local font asset metadata", () => {
        expect(LOCAL_THEME_FONT_PRELOADS).toContainEqual({
            href: "/fonts/proxima-vara.woff2",
            type: "font/woff2"
        })
        expect(getLocalThemeFontFaceCss()).toContain('font-family: "ProximaVara";')
        expect(getLocalThemeFontFaceCss()).toContain('url("/fonts/proxima-vara.woff2")')
    })
})
