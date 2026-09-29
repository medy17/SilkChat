// @vitest-environment jsdom

import {
    APP_SURFACE_FALLBACKS,
    USER_MESSAGE_FALLBACKS,
    applyThemeToElement
} from "@/lib/apply-theme"
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

        applyThemeToElement(createThemeState({ secondary: "oklch(0.4 0.12 145)" }), root, "dark")
        expect(root.style.getPropertyValue("--user-message")).toBe(USER_MESSAGE_FALLBACKS.theme)
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

    it("resets app-specific surfaces when the next theme does not provide them", () => {
        const root = document.createElement("div")

        applyThemeToElement(
            createThemeState({
                composer: "#2c2631",
                "code-background": "#1f1a24",
                "code-foreground": "#d8c3ef",
                "user-message-foreground": "#f2ebfa"
            }),
            root,
            "dark"
        )
        applyThemeToElement(createThemeState({}), root, "dark")

        expect(root.style.getPropertyValue("--composer")).toBe(APP_SURFACE_FALLBACKS.composer.dark)
        expect(root.style.getPropertyValue("--code-background")).toBe(
            APP_SURFACE_FALLBACKS["code-background"]
        )
        expect(root.style.getPropertyValue("--code-foreground")).toBe(
            APP_SURFACE_FALLBACKS["code-foreground"]
        )
        expect(root.style.getPropertyValue("--user-message-foreground")).toBe(
            APP_SURFACE_FALLBACKS["user-message-foreground"]
        )
    })
})

it("preserves imported theme tokens without overwriting HeroUI's semantic colors", () => {
    const root = document.createElement("div")
    root.style.setProperty("--accent", "var(--primary)")
    root.style.setProperty("--muted", "var(--muted-foreground)")
    const state = createThemeState({
        primary: "#123456",
        accent: "#345678",
        "accent-foreground": "#ffffff",
        muted: "#222222",
        "muted-foreground": "#aaaaaa",
        composer: "var(--accent)",
        "user-message": "var(--muted)"
    })
    applyThemeToElement(state, root, "dark")
    expect(root.style.getPropertyValue("--accent")).toBe("var(--primary)")
    expect(root.style.getPropertyValue("--muted")).toBe("var(--muted-foreground)")
    expect(root.style.getPropertyValue("--silk-accent")).toBe("#345678")
    expect(root.style.getPropertyValue("--silk-muted")).toBe("#222222")
    expect(root.style.getPropertyValue("--composer")).toBe("var(--silk-accent)")
    expect(root.style.getPropertyValue("--user-message")).toBe("var(--silk-muted)")
    expect(state.cssVars.dark.accent).toBe("#345678")
})
