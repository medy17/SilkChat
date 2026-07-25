import { buildAuthBaseURLConfig, hasLoopbackAuthHost } from "@/convex/lib/auth_origins"
import { describe, expect, it } from "vitest"

describe("Better Auth origin configuration", () => {
    it("keeps a static canonical URL when no additional hosts are configured", () => {
        expect(buildAuthBaseURLConfig("https://silkchat.dev")).toEqual({
            allowedHosts: ["silkchat.dev"],
            baseURL: "https://silkchat.dev"
        })
    })

    it("builds an exact dynamic allowlist for tunnel and localhost OAuth", () => {
        expect(
            buildAuthBaseURLConfig(
                "https://dev.silkchat.dev",
                "localhost:3000, 127.0.0.1:3000, https://dev.silkchat.dev"
            )
        ).toEqual({
            allowedHosts: ["dev.silkchat.dev", "localhost:3000", "127.0.0.1:3000"],
            baseURL: {
                allowedHosts: ["dev.silkchat.dev", "localhost:3000", "127.0.0.1:3000"],
                fallback: "https://dev.silkchat.dev",
                protocol: "auto"
            }
        })
    })

    it("rejects additional hosts containing URL paths", () => {
        expect(() =>
            buildAuthBaseURLConfig("https://dev.silkchat.dev", "localhost:3000/auth")
        ).toThrow("must be exact hosts")
    })

    it("rejects wildcard additional hosts", () => {
        expect(() => buildAuthBaseURLConfig("https://dev.silkchat.dev", "*.silkchat.dev")).toThrow(
            "without wildcards"
        )
        expect(() =>
            buildAuthBaseURLConfig("https://dev.silkchat.dev", "preview-?.silkchat.dev")
        ).toThrow("without wildcards")
    })

    it("recognizes loopback hosts independently of their ports", () => {
        expect(hasLoopbackAuthHost(["dev.silkchat.dev", "localhost:3000"])).toBe(true)
        expect(hasLoopbackAuthHost(["dev.silkchat.dev", "[::1]:3000"])).toBe(true)
        expect(hasLoopbackAuthHost(["dev.silkchat.dev"])).toBe(false)
    })
})
