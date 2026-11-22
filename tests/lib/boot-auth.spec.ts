// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The real client's getSession is a GET through Better Fetch; this stands in for it with
// the part that matters here: it uses the per-request fetch implementation when given one.
vi.mock("@/lib/auth-client", () => ({
    authClient: {
        getSession: async ({
            fetchOptions
        }: {
            fetchOptions: { customFetchImpl?: typeof fetch }
        }) => {
            const doFetch = fetchOptions.customFetchImpl ?? fetch
            const response = await doFetch("/api/auth/get-session")
            if (!response.ok) throw new Error(`get-session ${response.status}`)
            return response.json()
        },
        convex: { token: vi.fn() }
    }
}))

const signedInSession = { user: { id: "user-1" }, session: { id: "session-1" } }

const loadBootAuth = async () => {
    vi.resetModules()
    return import("@/lib/boot-auth")
}

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    window.__SILK_BOOT_AUTH__ = undefined
})

describe("buildBootAuthScript", () => {
    it("keeps embedded values from closing the inline script", async () => {
        const { buildBootAuthScript } = await loadBootAuth()
        const script = buildBootAuthScript({
            hasSession: true,
            convexToken: "</script><script>alert(1)</script>"
        })
        expect(script).not.toContain("</script>")
        expect(script).toContain("\\u003c/script>")
    })
})

describe("seedBootSession", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it("settles a visitor without a session cookie as signed out without asking the server", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        window.__SILK_BOOT_AUTH__ = { hasSession: false, convexToken: null }
        const { seedBootSession } = await loadBootAuth()
        const queryClient = new QueryClient()

        seedBootSession(queryClient)

        expect(queryClient.getQueryState(["session"])?.status).toBe("success")
        expect(queryClient.getQueryData(["session"])).toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("retries a failed early session request with a fresh one instead of signing the user out", async () => {
        const fetchMock = vi.fn(async () => Response.json(signedInSession))
        vi.stubGlobal("fetch", fetchMock)
        window.__SILK_BOOT_AUTH__ = {
            hasSession: true,
            convexToken: null,
            sessionResponse: Promise.resolve(new Response("unavailable", { status: 503 }))
        }
        const { isBootSessionPending, seedBootSession } = await loadBootAuth()
        const queryClient = new QueryClient()

        seedBootSession(queryClient)
        expect(isBootSessionPending()).toBe(true)
        await vi.waitFor(
            () => expect(queryClient.getQueryData(["session"])).toEqual(signedInSession),
            {
                timeout: 5000
            }
        )

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(queryClient.getQueryState(["session"])?.status).toBe("success")
        await vi.waitFor(() => expect(isBootSessionPending()).toBe(false))
    })
})
