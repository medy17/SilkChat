import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { browserEnv } from "@/lib/browser-env"

describe("browser-env", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud")
        vi.stubEnv("VITE_CONVEX_API_URL", "https://example.convex.site")
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it("throws when a caller treats an optional missing value as required", () => {
        expect(() => browserEnv("VITE_POSTHOG_KEY")).toThrow(
            "Missing environment variable(browser): VITE_POSTHOG_KEY"
        )
    })
})
