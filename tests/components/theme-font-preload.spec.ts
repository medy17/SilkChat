// @vitest-environment jsdom
import { ThemeScript } from "@/components/theme-script"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const bootstrap = () => {
    const script = ThemeScript().props.dangerouslySetInnerHTML.__html
    new Function(script)()
}

const saveTheme = (mode: "light" | "dark", lightFont: string, darkFont = lightFont) => {
    localStorage.setItem(
        "theme-store",
        JSON.stringify({
            state: {
                selectedThemeUrl: "custom-theme",
                themeState: {
                    currentMode: mode,
                    cssVars: {
                        theme: {
                            "font-sans": '"ProximaVara", sans-serif',
                            "font-mono": "monospace",
                            "font-serif": "serif"
                        },
                        light: { "font-sans": lightFont },
                        dark: { "font-sans": darkFont }
                    }
                }
            },
            version: 1
        })
    )
}

beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal("matchMedia", () => ({ matches: false }))
})

afterEach(() => {
    localStorage.clear()
    document.head.querySelectorAll("link").forEach((link) => link.remove())
    document.documentElement.removeAttribute("style")
    document.documentElement.removeAttribute("class")
})

describe("theme font bootstrap", () => {
    it("preloads the default local font once before React mounts", () => {
        bootstrap()
        bootstrap()
        const links = document.head.querySelectorAll(
            'link[rel="preload"][href="/fonts/proxima-vara.woff2"]'
        )
        expect(links).toHaveLength(1)
        expect((links[0] as HTMLLinkElement).as).toBe("font")
        expect((links[0] as HTMLLinkElement).crossOrigin).toBe("anonymous")
        expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain(
            "ProximaVara"
        )
    })

    it("loads the selected Google font without downloading unused Proxima", () => {
        saveTheme("light", "Inter, sans-serif")
        bootstrap()
        expect(document.head.querySelector('link[href="/fonts/proxima-vara.woff2"]')).toBeNull()
        expect(
            document.head.querySelector('link[data-theme-font="Inter"]')?.getAttribute("href")
        ).toContain("family=Inter:")
        expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe(
            "Inter, sans-serif"
        )
    })

    it("uses the active color mode's font override", () => {
        saveTheme("dark", "Inter, sans-serif", '"ProximaVara", sans-serif')
        bootstrap()
        expect(document.head.querySelector('link[href="/fonts/proxima-vara.woff2"]')).toBeTruthy()
        expect(document.head.querySelector('link[data-theme-font="Inter"]')).toBeNull()
    })
})
