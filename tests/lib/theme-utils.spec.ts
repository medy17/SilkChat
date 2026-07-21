import {
    LOCAL_THEME_FONTS,
    T3_CHAT_THEME_URL,
    type ThemePresetLike,
    applyBuiltInThemeOverrides
} from "@/lib/theme-font-config"
import {
    getBuiltInThemeUrl,
    getThemeResourceUrl,
    isMissingImportedThemeSelection,
    normalizeThemeImportUrl
} from "@/lib/theme-utils"
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
})

describe("theme URL identity", () => {
    it("accepts and normalizes the supported tweakcn import URL shapes", () => {
        expect(
            normalizeThemeImportUrl(" https://tweakcn.com/themes/cmndaz3pj000604js33fr1gsk ")
        ).toBe("https://tweakcn.com/themes/cmndaz3pj000604js33fr1gsk")
        expect(normalizeThemeImportUrl("https://tweakcn.com/editor/theme?theme=vercel")).toBe(
            "https://tweakcn.com/editor/theme?theme=vercel"
        )
    })

    it("rejects unsupported theme hosts and URL shapes", () => {
        expect(normalizeThemeImportUrl("https://example.com/themes/theme-id")).toBeNull()
        expect(normalizeThemeImportUrl("https://tweakcn.com/r/themes/vercel.json")).toBeNull()
        expect(normalizeThemeImportUrl("https://tweakcn.com/themes/theme-id/extra")).toBeNull()
        expect(
            normalizeThemeImportUrl("https://tweakcn.com/editor/theme?theme=vercel&preview=true")
        ).toBeNull()
    })

    it("recognizes alternate tweakcn URLs for a built-in theme", () => {
        expect(getThemeResourceUrl("https://tweakcn.com/editor/theme?theme=mono")).toBe(
            "https://tweakcn.com/r/themes/mono.json"
        )
        expect(getBuiltInThemeUrl("https://tweakcn.com/r/themes/mono.json")).toBe(
            "https://tweakcn.com/editor/theme?theme=mono"
        )
    })

    it("does not classify an unrelated imported theme as built-in", () => {
        expect(getBuiltInThemeUrl("https://tweakcn.com/r/themes/my-theme.json")).toBeUndefined()
    })

    it("detects a selected imported theme that is no longer synced", () => {
        const selectedThemeUrl = "https://tweakcn.com/r/themes/my-theme.json"

        expect(isMissingImportedThemeSelection(selectedThemeUrl, [])).toBe(true)
        expect(isMissingImportedThemeSelection(selectedThemeUrl, [selectedThemeUrl])).toBe(false)
        expect(isMissingImportedThemeSelection("https://tweakcn.com/r/themes/mono.json", [])).toBe(
            false
        )
    })
})
