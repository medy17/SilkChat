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
        expect(result.cssVars.light.background).toBe("#fdf7fd")
        expect(result.cssVars.light.primary).toBe("#db2777")
        expect(result.cssVars.light.composer).toBe("#fdfafd")
        expect(result.cssVars.light["user-message"]).toBe("#f7def2")
        expect(result.cssVars.light["user-message-foreground"]).toBe("#492c61")
        expect(result.cssVars.light["code-background"]).toBe("#f5ecf9")
        expect(result.cssVars.light.sidebar).toBe("#f2e1f4")
        expect(result.cssVars.dark.background).toBe("#1f1a24")
        expect(result.cssVars.dark.primary).toBe("#a3004c")
        expect(result.cssVars.dark.composer).toBe("#2c2631")
        expect(result.cssVars.dark["user-message"]).toBe("#2b2431")
        expect(result.cssVars.dark["user-message-foreground"]).toBe("#f2ebfa")
        expect(result.cssVars.dark["code-background"]).toBe("#1f1a24")
        expect(result.cssVars.dark.sidebar).toBe("#171018")
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
        expect(getThemeResourceUrl("https://tweakcn.com/themes/cmrzdtil2000704jldxp75mdg")).toBe(
            "https://tweakcn.com/r/themes/cmrzdtil2000704jldxp75mdg"
        )
        expect(getBuiltInThemeUrl("https://tweakcn.com/r/themes/cmrzdtil2000704jldxp75mdg")).toBe(
            "https://tweakcn.com/themes/cmrzdtil2000704jldxp75mdg"
        )
        expect(getBuiltInThemeUrl("https://tweakcn.com/r/themes/mono.json")).toBeUndefined()
    })

    it("keeps local app themes out of imported-theme cleanup", () => {
        const legacyThemeUrl = "silkchat:legacy-green"

        expect(isMissingImportedThemeSelection(legacyThemeUrl, [], [legacyThemeUrl])).toBe(false)
        expect(isMissingImportedThemeSelection(legacyThemeUrl, [])).toBe(true)
    })

    it("does not classify an unrelated imported theme as built-in", () => {
        expect(getBuiltInThemeUrl("https://tweakcn.com/r/themes/my-theme.json")).toBeUndefined()
    })

    it("detects a selected imported theme that is no longer synced", () => {
        const selectedThemeUrl = "https://tweakcn.com/r/themes/my-theme.json"

        expect(isMissingImportedThemeSelection(selectedThemeUrl, [])).toBe(true)
        expect(isMissingImportedThemeSelection(selectedThemeUrl, [selectedThemeUrl])).toBe(false)
        expect(
            isMissingImportedThemeSelection(
                "https://tweakcn.com/r/themes/cmrzdtil2000704jldxp75mdg",
                []
            )
        ).toBe(false)
    })
})
