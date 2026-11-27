import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchMock } = vi.hoisted(() => ({
    fetchMock: vi.fn()
}))

vi.mock("@/lib/auth-client", () => ({
    authClient: {
        convex: {
            token: fetchMock
        }
    }
}))

import { isJwtToken, resolveJwtToken } from "@/lib/auth-token"

const createJwt = (payload: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url")
    return `${header}.${encodedPayload}.signature`
}

describe("auth-token", () => {
    beforeEach(() => {
        fetchMock.mockReset()
    })

    it("accepts only structurally valid JWTs", () => {
        expect(isJwtToken(createJwt({ sub: "user-1" }))).toBe(true)
        expect(isJwtToken("not-a-jwt")).toBe(false)
        expect(isJwtToken("a..c")).toBe(false)
        expect(isJwtToken("a.b")).toBe(false)
        expect(isJwtToken(undefined)).toBe(false)
    })

    it("reuses an existing valid token without fetching", async () => {
        const token = createJwt({ sub: "user-1" })

        await expect(resolveJwtToken(`  ${token}  `)).resolves.toBe(token)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("refreshes the token when forced", async () => {
        const currentToken = createJwt({ sub: "stale-user" })
        const refreshedToken = createJwt({ sub: "fresh-user" })

        fetchMock.mockResolvedValue({
            data: {
                token: ` ${refreshedToken} `
            }
        })

        await expect(resolveJwtToken(currentToken, { forceRefresh: true })).resolves.toBe(
            refreshedToken
        )
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("falls back to the current valid token when refresh fails", async () => {
        const token = createJwt({ sub: "user-1" })
        fetchMock.mockRejectedValue(new Error("network"))

        await expect(resolveJwtToken(token, { forceRefresh: true })).resolves.toBe(token)
    })

    it("refreshes an expired token automatically", async () => {
        const expiredToken = createJwt({
            sub: "user-1",
            exp: Math.floor(Date.now() / 1000) - 65
        })
        const refreshedToken = createJwt({
            sub: "user-1",
            exp: Math.floor(Date.now() / 1000) + 3600
        })
        fetchMock.mockResolvedValue({ data: { token: refreshedToken } })

        await expect(resolveJwtToken(expiredToken)).resolves.toBe(refreshedToken)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("refreshes a token whose remaining lifetime is below minRemainingSeconds", async () => {
        const shortLivedToken = createJwt({
            sub: "user-1",
            exp: Math.floor(Date.now() / 1000) + 5 * 60
        })
        const refreshedToken = createJwt({
            sub: "user-1",
            exp: Math.floor(Date.now() / 1000) + 60 * 60
        })
        fetchMock.mockResolvedValue({ data: { token: refreshedToken } })

        await expect(
            resolveJwtToken(shortLivedToken, { minRemainingSeconds: 25 * 60 })
        ).resolves.toBe(refreshedToken)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("reuses a token that meets minRemainingSeconds without fetching", async () => {
        const freshToken = createJwt({
            sub: "user-1",
            exp: Math.floor(Date.now() / 1000) + 45 * 60
        })

        await expect(resolveJwtToken(freshToken, { minRemainingSeconds: 25 * 60 })).resolves.toBe(
            freshToken
        )
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("does not fall back to an already-expired token when refresh fails", async () => {
        const expiredToken = createJwt({
            sub: "user-1",
            exp: Math.floor(Date.now() / 1000) - 10
        })
        fetchMock.mockRejectedValue(new Error("network"))

        await expect(resolveJwtToken(expiredToken)).resolves.toBeUndefined()
    })

    it("returns undefined when neither the current nor fetched token is valid", async () => {
        fetchMock.mockResolvedValue({
            data: {
                token: "invalid"
            }
        })

        await expect(resolveJwtToken("still-invalid")).resolves.toBeUndefined()
    })
})
