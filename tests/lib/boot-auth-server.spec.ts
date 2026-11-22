import { describe, expect, it } from "vitest"
import { readBootAuthFromCookieHeader } from "@/lib/boot-auth-server"

const jwtExpiringIn = (seconds: number) => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
    const exp = Math.floor(Date.now() / 1000) + seconds
    return `${encode({ alg: "RS256" })}.${encode({ sub: "user", exp })}.signature`
}

describe("readBootAuthFromCookieHeader", () => {
    it("treats a visitor without a session cookie as signed out, whatever else is set", () => {
        expect(
            readBootAuthFromCookieHeader(`theme=dark; better-auth.convex_jwt=${jwtExpiringIn(600)}`)
        ).toEqual({ hasSession: false, convexToken: null })
    })

    it("recognises the secure-prefixed session cookie production sets", () => {
        expect(
            readBootAuthFromCookieHeader("__Secure-better-auth.session_token=abc.sig").hasSession
        ).toBe(true)
    })

    it("hands over the cookie JWT only while it has real lifetime left", () => {
        const fresh = jwtExpiringIn(600)
        const session = "better-auth.session_token=abc.sig"

        expect(
            readBootAuthFromCookieHeader(`${session}; better-auth.convex_jwt=${fresh}`).convexToken
        ).toBe(fresh)
        expect(
            readBootAuthFromCookieHeader(`${session}; better-auth.convex_jwt=${jwtExpiringIn(30)}`)
                .convexToken
        ).toBeNull()
        expect(
            readBootAuthFromCookieHeader(`${session}; better-auth.convex_jwt=not-a-jwt`)
        ).toEqual({ hasSession: true, convexToken: null })
    })
})
