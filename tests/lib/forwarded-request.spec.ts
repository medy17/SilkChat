import { restoreConfiguredHttpsOrigin } from "@/lib/forwarded-request"
import { describe, expect, it } from "vitest"

describe("forwarded request URL restoration", () => {
    it("restores the configured tunnel HTTPS origin before routes run", async () => {
        const request = new Request("http://dev.silkchat.dev/api/auth/sign-in/social", {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({ provider: "google" })
        })

        const restoredRequest = restoreConfiguredHttpsOrigin(request, "https://dev.silkchat.dev")

        expect(restoredRequest.url).toBe("https://dev.silkchat.dev/api/auth/sign-in/social")
        await expect(restoredRequest.json()).resolves.toEqual({ provider: "google" })
    })

    it("does not rewrite requests outside the exact configured tunnel origin", () => {
        const httpsRequest = new Request("https://silkchat.dev/api/auth/get-session", {
            headers: { "x-forwarded-proto": "https" }
        })
        const otherHostRequest = new Request("http://localhost:3000/api/auth/get-session", {
            headers: { "x-forwarded-proto": "https" }
        })

        expect(restoreConfiguredHttpsOrigin(httpsRequest, "https://dev.silkchat.dev")).toBe(
            httpsRequest
        )
        expect(restoreConfiguredHttpsOrigin(otherHostRequest, "https://dev.silkchat.dev")).toBe(
            otherHostRequest
        )
        expect(restoreConfiguredHttpsOrigin(otherHostRequest)).toBe(otherHostRequest)
    })
})
