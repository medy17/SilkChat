import type { QueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"

/**
 * What the server learned from the request cookies, with no network call: whether a
 * Better Auth session cookie is present, and the Convex JWT from the `convex_jwt` cookie
 * when it is still fresh. The decision between the landing page and the chat is made from
 * this before any JavaScript loads.
 */
export type BootAuthState = {
    hasSession: boolean
    convexToken: string | null
}

type BootAuthGlobal = BootAuthState & {
    // Started by the inline head script, so they run while the app bundle downloads.
    sessionResponse?: Promise<Response>
    tokenResponse?: Promise<Response>
}

declare global {
    interface Window {
        __SILK_BOOT_AUTH__?: BootAuthGlobal
    }
}

export const SESSION_QUERY_KEY = ["session"] as const

// JSON is not script-safe on its own: `</script>` or U+2028 inside a value would end or
// break the inline script.
const toInlineJson = (value: unknown) =>
    JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029")

/**
 * Inline head script. With a session cookie it starts /get-session (and /convex/token when
 * the cookie JWT is stale) at HTML parse time instead of after the bundle has executed.
 */
export const buildBootAuthScript = (state: BootAuthState) =>
    `(function(){try{var b=window.__SILK_BOOT_AUTH__=${toInlineJson(state)};if(!b.hasSession)return;var o={credentials:"include"};var q=function(p){var r=fetch(p,o);r.catch(function(){});return r};b.sessionResponse=q("/api/auth/get-session");if(!b.convexToken)b.tokenResponse=q("/api/auth/convex/token")}catch(e){}})();`

const getBootGlobal = (): BootAuthGlobal | undefined =>
    typeof window === "undefined" ? undefined : window.__SILK_BOOT_AUTH__

export const readBootAuth = (): BootAuthState | null => {
    const boot = getBootGlobal()
    return boot ? { hasSession: boot.hasSession, convexToken: boot.convexToken } : null
}

/**
 * Hands an early response to Better Fetch as a one-shot fetch implementation, so the
 * client's own parser, date revival and plugins treat it exactly like a request it made.
 * A failed early request falls back to a real one.
 */
const takeBootFetch = (key: "sessionResponse" | "tokenResponse") => {
    const boot = getBootGlobal()
    let pending = boot?.[key]
    if (!boot || !pending) return undefined
    boot[key] = undefined
    return (input: RequestInfo | URL, init?: RequestInit) => {
        // A response body can only be read once, so any retry makes a real request.
        const early = pending
        pending = undefined
        return early ? early.catch(() => fetch(input, init)) : fetch(input, init)
    }
}

/** Decodes a JWT's claims without verifying it; Convex verifies. */
export const readJwtClaims = (token: string): { sub?: string; exp?: number } | null => {
    try {
        const payload = token.split(".")[1] ?? ""
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    } catch {
        return null
    }
}

let bootSessionPending = false

/** True from boot until the seeded session request settles. One-shot: a later refetch
 * (after sign-out, say) is a real unknown, not a returning signed-in user. */
export const isBootSessionPending = () => bootSessionPending

/**
 * The Convex token the boot produced, from the fresh cookie JWT or the early request.
 * `null` means the server said there is no token (the session is gone), so asking again is
 * pointless; `undefined` means the early request failed and a real one is worth making.
 */
type BootConvexToken = string | null | undefined
let bootConvexTokenSource: Promise<BootConvexToken> | null = null
let hasTakenBootConvexToken = false

/** One-shot handoff to Convex auth's first token fetch. */
export const takeBootConvexToken = (): Promise<BootConvexToken> | null => {
    if (hasTakenBootConvexToken) return null
    hasTakenBootConvexToken = true
    return bootConvexTokenSource
}

const fetchBootConvexToken = async (
    customFetchImpl: ReturnType<typeof takeBootFetch>
): Promise<BootConvexToken> => {
    const { data, error } = await authClient.convex.token({
        fetchOptions: { throw: false, ...(customFetchImpl ? { customFetchImpl } : {}) }
    })
    if (data?.token) return data.token
    return error?.status === 401 ? null : undefined
}

// Matches the retries every useSession observer would have made had it fetched itself.
const BOOT_SESSION_RETRIES = 3

let hasSeeded = false

/**
 * Seeds the shared `["session"]` query before the first render. Without a session cookie
 * the answer is already known (signed out), so no request is made at all. With one, the
 * query adopts the early /get-session response that is already in flight.
 */
export const seedBootSession = (queryClient: QueryClient) => {
    if (hasSeeded) return
    hasSeeded = true

    const boot = readBootAuth()
    if (!boot) return

    if (!boot.hasSession) {
        queryClient.setQueryData(SESSION_QUERY_KEY, null)
        return
    }

    const tokenFetch = takeBootFetch("tokenResponse")
    const tokenSource = boot.convexToken
        ? Promise.resolve(boot.convexToken)
        : tokenFetch
          ? fetchBootConvexToken(tokenFetch).catch((): BootConvexToken => undefined)
          : null
    bootConvexTokenSource = tokenSource

    bootSessionPending = true
    const sessionFetch = takeBootFetch("sessionResponse")
    void queryClient
        .prefetchQuery({
            queryKey: SESSION_QUERY_KEY,
            queryFn: () =>
                authClient.getSession({
                    fetchOptions: {
                        throw: true,
                        ...(sessionFetch ? { customFetchImpl: sessionFetch } : {})
                    }
                }),
            // prefetchQuery doesn't retry by default, and a single transient failure would
            // otherwise settle a signed-in user as signed out.
            retry: BOOT_SESSION_RETRIES
        })
        .finally(() => {
            bootSessionPending = false
        })
        .then(async () => {
            // Hand the boot token to useToken as well, so the first send doesn't fetch it again.
            const userId = (
                queryClient.getQueryData(SESSION_QUERY_KEY) as { user?: { id?: string } } | null
            )?.user?.id
            const token = tokenSource ? await tokenSource : null
            if (!userId || !token || queryClient.getQueryData(["token", userId])) return
            // A cookie JWT left over from another account must not be handed to this one.
            if (readJwtClaims(token)?.sub !== userId) return
            queryClient.setQueryData(["token", userId], { token })
        })
}
