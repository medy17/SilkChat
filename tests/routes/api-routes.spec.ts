import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchAuthQueryMock, fetchAuthMutationMock, getSessionMock } = vi.hoisted(() => {
    process.env.VITE_POSTHOG_HOST = "https://ph.example.com"
    return {
        fetchAuthQueryMock: vi.fn(),
        fetchAuthMutationMock: vi.fn(),
        getSessionMock: vi.fn()
    }
})

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (config: unknown) => config
}))

vi.mock("@/lib/auth-server", () => ({
    authServer: {
        api: {
            getSession: getSessionMock
        },
        fetchAuthQuery: fetchAuthQueryMock,
        fetchAuthMutation: fetchAuthMutationMock
    }
}))

import { Route as CreditSummaryRoute } from "@/routes/api/credit-summary"
import { Route as DevCreditPlanRoute } from "@/routes/api/dev/credit-plan"
import { Route as PosthogProxyRoute } from "@/routes/api/phr/$"

type RouteHandlers = {
    server: {
        handlers: {
            GET?: (args: { request: Request }) => Promise<Response>
            POST?: (args: { request: Request }) => Promise<Response>
        }
    }
}

const creditSummaryHandlers = (CreditSummaryRoute as unknown as RouteHandlers).server.handlers
const devCreditPlanHandlers = (DevCreditPlanRoute as unknown as RouteHandlers).server.handlers
const posthogProxyHandlers = (PosthogProxyRoute as unknown as RouteHandlers).server.handlers

describe("API routes", () => {
    beforeEach(() => {
        fetchAuthQueryMock.mockReset()
        fetchAuthMutationMock.mockReset()
        getSessionMock.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
        Reflect.deleteProperty(process.env, "NODE_ENV")
    })

    it("returns credit summary for an authenticated user", async () => {
        fetchAuthQueryMock.mockResolvedValueOnce({
            enabled: true,
            plan: "pro",
            periodKey: "2026-05",
            periodStartsAt: 1,
            periodEndsAt: 2,
            basic: {
                limit: 1500,
                used: 10,
                remaining: 1490
            },
            pro: {
                limit: 100,
                used: 1,
                remaining: 99
            },
            requestCounts: {
                internal: 11,
                byok: 0,
                total: 11
            }
        })

        const response = await creditSummaryHandlers.GET!({
            request: new Request("https://example.com/api/credit-summary")
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            enabled: true,
            plan: "pro",
            periodKey: "2026-05",
            periodStartsAt: 1,
            periodEndsAt: 2,
            basic: {
                limit: 1500,
                used: 10,
                remaining: 1490
            },
            pro: {
                limit: 100,
                used: 1,
                remaining: 99
            },
            requestCounts: {
                internal: 11,
                byok: 0,
                total: 11
            }
        })
    })

    it("enforces auth and dev-only constraints on the credit-plan route", async () => {
        process.env.NODE_ENV = "production"

        const prodResponse = await devCreditPlanHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-plan", {
                method: "POST",
                body: JSON.stringify({ plan: "pro" })
            })
        })

        expect(prodResponse.status).toBe(404)

        process.env.NODE_ENV = "development"
        fetchAuthQueryMock.mockResolvedValueOnce({ id: "user-1" })
        const invalidPlanResponse = await devCreditPlanHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-plan", {
                method: "POST",
                body: JSON.stringify({ plan: "enterprise" })
            })
        })

        expect(invalidPlanResponse.status).toBe(400)
        await expect(invalidPlanResponse.json()).resolves.toEqual({
            error: "Invalid plan"
        })
    })

    it("updates the credit plan in development for authenticated users", async () => {
        process.env.NODE_ENV = "development"
        fetchAuthQueryMock.mockResolvedValueOnce({ id: "user-1" })
        fetchAuthMutationMock.mockResolvedValueOnce({
            plan: "free"
        })

        const response = await devCreditPlanHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-plan", {
                method: "POST",
                body: JSON.stringify({ plan: "free" })
            })
        })

        expect(fetchAuthMutationMock).toHaveBeenCalledWith(expect.anything(), {
            plan: "free"
        })
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            ok: true,
            plan: "free"
        })
    })

    it("returns 401 from auth-dependent routes when the Convex auth user is missing", async () => {
        fetchAuthQueryMock.mockResolvedValueOnce(null)
        getSessionMock.mockResolvedValueOnce(null)
        fetchAuthMutationMock.mockRejectedValueOnce(new Error("Unauthenticated"))
        process.env.NODE_ENV = "development"

        const creditSummaryResponse = await creditSummaryHandlers.GET!({
            request: new Request("https://example.com/api/credit-summary")
        })
        const devPlanResponse = await devCreditPlanHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-plan", {
                method: "POST",
                body: JSON.stringify({ plan: "free" })
            })
        })

        expect(creditSummaryResponse.status).toBe(401)
        await expect(creditSummaryResponse.json()).resolves.toEqual({
            error: "Unauthorized"
        })
        expect(devPlanResponse.status).toBe(401)
        await expect(devPlanResponse.json()).resolves.toEqual({
            error: "Unauthorized"
        })
    })

    it("proxies PostHog requests, strips host/content-length/content-encoding, and adds CORS headers", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
                headers: {
                    "content-type": "application/json",
                    "content-length": "999",
                    "content-encoding": "gzip",
                    "x-test": "ok"
                }
            })
        )
        vi.stubGlobal("fetch", fetchMock)

        const response = await posthogProxyHandlers.GET!({
            request: new Request("https://example.com/api/phr/capture?foo=bar", {
                headers: {
                    host: "example.com",
                    origin: "https://app.example.com",
                    authorization: "Bearer token"
                }
            })
        })

        expect(fetchMock).toHaveBeenCalledWith(
            "https://ph.example.com/capture?foo=bar",
            expect.objectContaining({
                method: "GET",
                headers: {
                    origin: "https://app.example.com",
                    authorization: "Bearer token"
                }
            })
        )
        expect(response.headers.get("content-length")).toBeNull()
        expect(response.headers.get("content-encoding")).toBeNull()
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
        expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true")
        expect(await response.arrayBuffer()).toBeInstanceOf(ArrayBuffer)
    })
})
