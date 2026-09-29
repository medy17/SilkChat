import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"
import { vi } from "vitest"

const originalEnv = { ...process.env }

beforeEach(() => {
    // jsdom has no layout or scrolling; dialogs still restore the window's scroll position.
    if (typeof window !== "undefined") {
        vi.spyOn(window, "scrollTo").mockImplementation(() => {})
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
