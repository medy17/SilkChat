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

    it("coalesces concurrent duplicate get-session GET requests", async () => {
        let resolveResponse: ((response: Response) => void) | undefined
        authHandlerMock.mockImplementationOnce(
            () =>
                new Promise<Response>((resolve) => {
                    resolveResponse = resolve
                })
        )

        const request = new Request("https://example.com/api/auth/get-session", {
            headers: {
                cookie: "better-auth.session_token=session-1"
            }
        })

        const firstResponsePromise = routeHandlers.GET({ request })
        const secondResponsePromise = routeHandlers.GET({ request })

        expect(authHandlerMock).toHaveBeenCalledTimes(1)

        resolveResponse?.(new Response(JSON.stringify({ ok: true }), { status: 200 }))

        const [firstResponse, secondResponse] = await Promise.all([
            firstResponsePromise,
            secondResponsePromise
        ])

        expect(await firstResponse.json()).toEqual({ ok: true })
        expect(await secondResponse.json()).toEqual({ ok: true })
    })

    it("reuses a fresh get-session GET response for immediate duplicates", async () => {
        authHandlerMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ session: { id: "session-1" } }), { status: 200 })
        )

        const request = new Request("https://example.com/api/auth/get-session", {
            headers: {
                cookie: "better-auth.session_token=session-2"
            }
        })

        const firstResponse = await routeHandlers.GET({ request })
        const secondResponse = await routeHandlers.GET({ request })

        expect(authHandlerMock).toHaveBeenCalledTimes(1)
        expect(await firstResponse.json()).toEqual({ session: { id: "session-1" } })
        expect(await secondResponse.json()).toEqual({ session: { id: "session-1" } })
    })
})
