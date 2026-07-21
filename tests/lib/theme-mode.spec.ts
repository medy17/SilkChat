import { getNextThemeMode, resolveThemeMode } from "@/lib/theme-mode"
import { describe, expect, it, vi } from "vitest"

describe("theme mode", () => {
    it("cycles through system, light, and dark", () => {
        expect(getNextThemeMode("system")).toBe("light")
        expect(getNextThemeMode("light")).toBe("dark")
        expect(getNextThemeMode("dark")).toBe("system")
    })

    it("resolves system mode from the operating system preference", () => {
        vi.stubGlobal("window", {
            matchMedia: () => ({ matches: true })
        })

        expect(resolveThemeMode("system")).toBe("dark")
        expect(resolveThemeMode("light")).toBe("light")

        vi.unstubAllGlobals()
    })
})
