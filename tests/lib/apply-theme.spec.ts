// @vitest-environment jsdom

import { USER_MESSAGE_FALLBACKS, applyThemeToElement } from "@/lib/apply-theme"
import { describe, expect, it } from "vitest"

const createThemeState = (dark: Record<string, string>) => ({
    currentMode: "dark" as const,
    cssVars: {
        theme: {},
        light: {},
        dark
    }
})

describe("applyThemeToElement user message color", () => {
    it("replaces a previous theme's bubble color with the active theme fallback", () => {
        const root = document.createElement("div")

        applyThemeToElement(createThemeState({ secondary: "oklch(0.25 0 0)" }), root, "dark", {
            isDefaultTheme: true
        })
        expect(root.style.getPropertyValue("--user-message")).toBe(
            USER_MESSAGE_FALLBACKS.default.dark
        )

        applyThemeToElement(
            createThemeState({ secondary: "oklch(0.4 0.12 145)" }),
            root,
            "dark"
        )
        expect(root.style.getPropertyValue("--user-message")).toBe(
            USER_MESSAGE_FALLBACKS.theme
        )
    })

    it("preserves a theme-provided bubble color", () => {
        const root = document.createElement("div")
        const userMessage = "oklch(0.5 0.14 145)"

        applyThemeToElement(
            createThemeState({
                secondary: "oklch(0.4 0.12 145)",
                "user-message": userMessage
            }),
            root,
            "dark"
        )

        expect(root.style.getPropertyValue("--user-message")).toBe(userMessage)
    })
})
