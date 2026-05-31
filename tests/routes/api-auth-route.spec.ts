import { beforeEach, describe, expect, it, vi } from "vitest"

const { authHandlerMock } = vi.hoisted(() => ({
    authHandlerMock: vi.fn()
}))

vi.mock("@/lib/auth-server", () => ({
    authServer: {
        handler: authHandlerMock
    }
}))

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (config: unknown) => config
}))

import { Route } from "@/routes/api/auth/$"

const routeHandlers = (
    Route as unknown as {
        server: {
            handlers: {
                GET: (args: { request: Request }) => Promise<Response>
                POST: (args: { request: Request }) => Promise<Response>
            }
        }
    }
).server.handlers

describe("api auth route", () => {
    beforeEach(() => {
        authHandlerMock.mockReset()
    })

    it("proxies auth GET requests to the Convex-backed auth handler", async () => {
        const proxiedResponse = new Response("ok", { status: 200 })
        authHandlerMock.mockResolvedValueOnce(proxiedResponse)
        const response = await routeHandlers.GET({
            request: new Request("https://example.com/api/auth/sign-in")
        })

        expect(response).toBe(proxiedResponse)
        expect(authHandlerMock).toHaveBeenCalledTimes(1)
    })

    it("proxies auth POST requests to the Convex-backed auth handler", async () => {
        const proxiedResponse = new Response("created", { status: 201 })
        authHandlerMock.mockResolvedValueOnce(proxiedResponse)
        const response = await routeHandlers.POST({
            request: new Request("https://example.com/api/auth/sign-out", {
                method: "POST"
            })
        })

        expect(response).toBe(proxiedResponse)
        expect(authHandlerMock).toHaveBeenCalledTimes(1)
    })
})
