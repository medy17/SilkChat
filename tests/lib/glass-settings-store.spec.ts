// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadStore = async () => {
    vi.resetModules()
    return await import("@/lib/glass-settings-store")
}

const persist = (state: Record<string, unknown>) =>
    localStorage.setItem("glass-settings-store", JSON.stringify({ state, version: 0 }))

const runBootScript = (script: string) => {
    new Function(script)()
}

describe("glass-settings-store", () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute("data-glass")
        document.documentElement.style.removeProperty("--glass-intensity")
    })

    it("restores persisted settings and drops an intensity outside the steps", async () => {
        persist({ enabled: false, intensity: 1.25 })
        const first = await loadStore()
        await first.useGlassSettingsStore.persist.rehydrate()
        expect(first.useGlassSettingsStore.getState()).toMatchObject({
            enabled: false,
            intensity: 1.25
        })

        persist({ enabled: false, intensity: 0.1 })
        const second = await loadStore()
        await second.useGlassSettingsStore.persist.rehydrate()
        expect(second.useGlassSettingsStore.getState()).toMatchObject({
            enabled: true,
            intensity: 1
        })
    })

    it("applies the persisted setting to the root before the app loads", async () => {
        const { GLASS_BOOT_SCRIPT } = await loadStore()
        const root = document.documentElement

        runBootScript(GLASS_BOOT_SCRIPT)
        expect(root.dataset.glass).toBe("on")
        expect(root.style.getPropertyValue("--glass-intensity")).toBe("")

        persist({ enabled: false, intensity: 1.5 })
        runBootScript(GLASS_BOOT_SCRIPT)
        expect(root.dataset.glass).toBe("off")
        expect(root.style.getPropertyValue("--glass-intensity")).toBe("1.5")

        localStorage.setItem("glass-settings-store", "{not json")
        expect(() => runBootScript(GLASS_BOOT_SCRIPT)).not.toThrow()
    })

    it("labels each step by the transparency of floating controls", async () => {
        const { GLASS_INTENSITY_STEPS, getGlassTransparencyLabel } = await loadStore()

        expect(GLASS_INTENSITY_STEPS.map(getGlassTransparencyLabel)).toEqual([
            "20%",
            "30%",
            "40%",
            "50%",
            "60%"
        ])
    })
})
