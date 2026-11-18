import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"
import { vi } from "vitest"

const originalEnv = { ...process.env }

beforeEach(() => {
    // jsdom has no layout or scrolling; dialogs still restore the window's scroll position.
    if (typeof window !== "undefined") {
        vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    }
    // jsdom computes animation-name (vaul injects exit keyframes) but never fires animationend,
    // so Radix Presence would keep closed drawers mounted. Turn animations off instead.
    if (typeof document !== "undefined" && !document.getElementById("test-no-animations")) {
        const style = document.createElement("style")
        style.id = "test-no-animations"
        style.textContent = "*,*::before,*::after{animation:none!important}"
        document.head.append(style)
    }
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()

    for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
            Reflect.deleteProperty(process.env, key)
        }
    }

    Object.assign(process.env, originalEnv)
})
