import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { browserEnv, optionalBrowserEnv } from "@/lib/browser-env"

describe("browser-env", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud")
        vi.stubEnv("VITE_CONVEX_API_URL", "https://example.convex.site")
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it("returns configured browser env values and exposes undefined for optional ones", () => {
        expect(browserEnv("VITE_CONVEX_URL")).toEqual(expect.any(String))
        expect(browserEnv("VITE_CONVEX_URL").length).toBeGreaterThan(0)
        expect([undefined, ""]).toContain(optionalBrowserEnv("VITE_POSTHOG_KEY"))
    })

    it("throws when a caller treats an optional missing value as required", () => {
        expect(() => browserEnv("VITE_POSTHOG_KEY")).toThrow(
            "Missing environment variable(browser): VITE_POSTHOG_KEY"
        )
    })
})
