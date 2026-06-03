import { describe, expect, it, vi } from "vitest"

import { getOpenRouterAttribution } from "../../convex/lib/openrouter_attribution"

describe("openrouter attribution", () => {
    it("uses the production SilkChat attribution by default", () => {
        Reflect.deleteProperty(process.env, "VITE_BETTER_AUTH_URL")
        Reflect.deleteProperty(process.env, "NODE_ENV")

        expect(getOpenRouterAttribution()).toEqual({
            appName: "SilkChat",
            appUrl: "https://silkchat.dev",
            headers: {
                "X-OpenRouter-Categories": "general-chat"
            }
        })
    })

    it("uses the local development attribution for localhost URLs", () => {
        vi.stubEnv("VITE_BETTER_AUTH_URL", "http://localhost:3000")

        expect(getOpenRouterAttribution()).toEqual({
            appName: "SilkChat-Dev",
            appUrl: "http://localhost:3000",
            headers: {
                "X-OpenRouter-Categories": "general-chat"
            }
        })
    })
})
