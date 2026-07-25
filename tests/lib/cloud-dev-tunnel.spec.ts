import { describe, expect, it } from "vitest"
import { addViteAllowedHost, getCloudDevTunnelConfig } from "../../scripts/lib/cloud-dev-tunnel.mjs"

describe("cloud development tunnel configuration", () => {
    it("keeps the tunnel disabled when neither setting exists", () => {
        expect(getCloudDevTunnelConfig({})).toBeNull()
    })

    it("requires the public URL and tunnel token together", () => {
        expect(() =>
            getCloudDevTunnelConfig({
                DEV_PUBLIC_URL: "https://dev.silkchat.example"
            })
        ).toThrow("must both be set")

        expect(() =>
            getCloudDevTunnelConfig({
                CLOUDFLARE_TUNNEL_TOKEN: "secret"
            })
        ).toThrow("must both be set")
    })

    it("accepts only a clean HTTPS origin", () => {
        expect(
            getCloudDevTunnelConfig({
                DEV_PUBLIC_URL: " https://dev.silkchat.example/ ",
                CLOUDFLARE_TUNNEL_TOKEN: " secret "
            })
        ).toEqual({
            hostname: "dev.silkchat.example",
            publicUrl: "https://dev.silkchat.example",
            token: "secret"
        })

        for (const publicUrl of [
            "http://dev.silkchat.example",
            "https://dev.silkchat.example:8443",
            "https://dev.silkchat.example/app",
            "https://user@dev.silkchat.example",
            "not-a-url"
        ]) {
            expect(() =>
                getCloudDevTunnelConfig({
                    DEV_PUBLIC_URL: publicUrl,
                    CLOUDFLARE_TUNNEL_TOKEN: "secret"
                })
            ).toThrow(/HTTPS/)
        }
    })

    it("adds the configured hostname to Vite without discarding existing hosts", () => {
        expect(
            addViteAllowedHost(
                {
                    __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: "preview.example, dev.silkchat.example"
                },
                "dev.silkchat.example"
            )
        ).toBe("preview.example,dev.silkchat.example")
    })
})
