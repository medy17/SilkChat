import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchAuthQueryMock, fetchAuthMutationMock, getSessionMock, searchBraveImagesMock } =
    vi.hoisted(() => {
        return {
            fetchAuthQueryMock: vi.fn(),
            fetchAuthMutationMock: vi.fn(),
            getSessionMock: vi.fn(),
            searchBraveImagesMock: vi.fn()
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

vi.mock("@/lib/brave-image-search", () => ({
    searchBraveImages: searchBraveImagesMock
}))

import { Route as CreditSummaryRoute } from "@/routes/api/credit-summary"
import { Route as DevCreditStateRoute } from "@/routes/api/dev/credit-state"
import { Route as RecipeVisualsRoute } from "@/routes/api/recipe-visuals"

type RouteHandlers = {
    server: {
        handlers: {
            GET?: (args: { request: Request }) => Promise<Response>
            POST?: (args: { request: Request }) => Promise<Response>
        }
    }
}

const creditSummaryHandlers = (CreditSummaryRoute as unknown as RouteHandlers).server.handlers
const devCreditStateHandlers = (DevCreditStateRoute as unknown as RouteHandlers).server.handlers
const recipeVisualsHandlers = (RecipeVisualsRoute as unknown as RouteHandlers).server.handlers

describe("API routes", () => {
    beforeEach(() => {
        fetchAuthQueryMock.mockReset()
        fetchAuthMutationMock.mockReset()
        getSessionMock.mockReset()
        searchBraveImagesMock.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
        Reflect.deleteProperty(process.env, "NODE_ENV")
        Reflect.deleteProperty(process.env, "BRAVE_API_KEY")
    })

    it("returns credit summary for an authenticated user", async () => {
        fetchAuthQueryMock.mockResolvedValueOnce({
            enabled: true,
            plan: "pro",
            usageMetering: {
                fiveHourLimitUsd: 5,
                monthlyLimitUsd: 50
            }
        })

        const response = await creditSummaryHandlers.GET!({
            request: new Request("https://example.com/api/credit-summary")
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            enabled: true,
            plan: "pro",
            usageMetering: {
                fiveHourLimitUsd: 5,
                monthlyLimitUsd: 50
            }
        })
    })

    it("returns 401 from auth-dependent routes when the Convex auth user is missing", async () => {
        fetchAuthQueryMock.mockResolvedValueOnce(null)
        getSessionMock.mockResolvedValueOnce(null)
        const creditSummaryResponse = await creditSummaryHandlers.GET!({
            request: new Request("https://example.com/api/credit-summary")
        })

        expect(creditSummaryResponse.status).toBe(401)
        await expect(creditSummaryResponse.json()).resolves.toEqual({
            error: "Unauthorized"
        })

        fetchAuthQueryMock.mockResolvedValueOnce(null)
        const recipeVisualsResponse = await recipeVisualsHandlers.GET!({
            request: new Request("https://example.com/api/recipe-visuals?q=shuwa")
        })
        expect(recipeVisualsResponse.status).toBe(401)
    })

    it("keeps Brave recipe image search server-side and configuration-gated", async () => {
        fetchAuthQueryMock.mockResolvedValue({ id: "user-1" })

        const unconfiguredResponse = await recipeVisualsHandlers.GET!({
            request: new Request("https://example.com/api/recipe-visuals?q=shuwa")
        })
        expect(unconfiguredResponse.status).toBe(503)

        process.env.BRAVE_API_KEY = "server-brave-key"
        fetchAuthMutationMock.mockResolvedValueOnce({
            allowed: true,
            retryAfterSeconds: 0,
            unauthorized: false
        })
        searchBraveImagesMock.mockResolvedValueOnce([
            {
                id: "visual-1",
                title: "Shuwa",
                thumbnailUrl: "https://cdn.example.com/shuwa.jpg",
                sourceUrl: "https://example.com/shuwa",
                source: "example.com"
            }
        ])
        const response = await recipeVisualsHandlers.GET!({
            request: new Request(
                "https://example.com/api/recipe-visuals?q=wrapping%20shuwa&limit=99&variant=step"
            )
        })

        expect(response.status).toBe(200)
        expect(searchBraveImagesMock).toHaveBeenCalledWith({
            cue: "wrapping shuwa",
            limit: 3,
            variant: "step",
            apiKey: "server-brave-key"
        })
        await expect(response.json()).resolves.toMatchObject({
            visuals: [
                {
                    id: "visual-1",
                    thumbnailUrl: "https://cdn.example.com/shuwa.jpg"
                }
            ]
        })
    })

    it("rate limits recipe visual searches before calling Brave", async () => {
        process.env.BRAVE_API_KEY = "server-brave-key"
        fetchAuthQueryMock.mockResolvedValue({ id: "user-1" })
        fetchAuthMutationMock.mockResolvedValueOnce({
            allowed: false,
            retryAfterSeconds: 120,
            unauthorized: false
        })

        const response = await recipeVisualsHandlers.GET!({
            request: new Request("https://example.com/api/recipe-visuals?q=shuwa")
        })

        expect(response.status).toBe(429)
        expect(response.headers.get("Retry-After")).toBe("120")
        expect(searchBraveImagesMock).not.toHaveBeenCalled()
    })

    it("enforces auth and dev-only constraints on the credit-state route", async () => {
        process.env.NODE_ENV = "production"

        const prodResponse = await devCreditStateHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-state", {
                method: "POST",
                body: JSON.stringify({ plan: "pro" })
            })
        })

        expect(prodResponse.status).toBe(404)

        process.env.NODE_ENV = "development"
        fetchAuthQueryMock.mockResolvedValueOnce(null)

        const unauthorizedResponse = await devCreditStateHandlers.GET!({
            request: new Request("https://example.com/api/dev/credit-state")
        })

        expect(unauthorizedResponse.status).toBe(401)
    })

    it("validates and updates development credit state", async () => {
        process.env.NODE_ENV = "development"
        fetchAuthQueryMock.mockResolvedValue({ id: "user-1" })

        const invalidResponse = await devCreditStateHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-state", {
                method: "POST",
                body: JSON.stringify({ isStaff: "yes" })
            })
        })

        expect(invalidResponse.status).toBe(400)
        await expect(invalidResponse.json()).resolves.toEqual({
            error: "Invalid isStaff"
        })

        const invalidScenarioResponse = await devCreditStateHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-state", {
                method: "POST",
                body: JSON.stringify({ usageScenario: "usage_5h_impossible" })
            })
        })

        expect(invalidScenarioResponse.status).toBe(400)
        await expect(invalidScenarioResponse.json()).resolves.toEqual({
            error: "Invalid usageScenario"
        })

        fetchAuthMutationMock.mockResolvedValueOnce({
            ok: true,
            account: {
                plan: "pro"
            },
            access: {
                isStaff: true,
                bypassLimits: false,
                bypassToolCallLimits: true
            }
        })

        const response = await devCreditStateHandlers.POST!({
            request: new Request("https://example.com/api/dev/credit-state", {
                method: "POST",
                body: JSON.stringify({
                    plan: "pro",
                    isStaff: true,
                    bypassLimits: false,
                    bypassToolCallLimits: true,
                    usageScenario: "usage_5h_exhausted",
                    periodAnchorPreset: "ending_tomorrow"
                })
            })
        })

        expect(fetchAuthMutationMock).toHaveBeenCalledWith(expect.anything(), {
            plan: "pro",
            isStaff: true,
            bypassLimits: false,
            bypassToolCallLimits: true,
            usageScenario: "usage_5h_exhausted",
            periodAnchorPreset: "ending_tomorrow"
        })
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            account: {
                plan: "pro"
            },
            access: {
                isStaff: true,
                bypassLimits: false,
                bypassToolCallLimits: true
            }
        })
    })
})
