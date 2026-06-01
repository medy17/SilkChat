import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

const COALESCED_AUTH_GET_PATHS = new Set([
    "/api/auth/get-session",
    "/api/auth/convex/token",
    "/api/auth/convex/jwks"
])
const COALESCED_AUTH_GET_TTL_MS = 1500
const COALESCED_AUTH_JWKS_TTL_MS = 10000

type ResponseSnapshot = {
    body: ArrayBuffer
    headers: Array<[string, string]>
    status: number
    statusText: string
}

const authGetSnapshotCache = new Map<
    string,
    {
        expiresAt: number
        snapshotPromise: Promise<ResponseSnapshot>
    }
>()

const withForwardedClientIp = (request: Request) => {
    const headers = new Headers(request.headers)
    const requestUrl = new URL(request.url)
    const forwardedFor = headers.get("x-forwarded-for")?.trim()

    if (!forwardedFor) {
        const fallbackIp =
            headers.get("cf-connecting-ip")?.trim() ||
            headers.get("x-real-ip")?.trim() ||
            (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1"
                ? "127.0.0.1"
                : "")

        if (fallbackIp) {
            headers.set("x-forwarded-for", fallbackIp)
        }
    }

    if (!headers.get("x-real-ip")) {
        const firstForwardedIp = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        if (firstForwardedIp) {
            headers.set("x-real-ip", firstForwardedIp)
        }
    }

    return new Request(request.url, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        // Required by undici when forwarding streaming bodies in Node.
        // @ts-expect-error duplex is supported in the runtime fetch implementation.
        duplex: request.method === "GET" || request.method === "HEAD" ? undefined : "half"
    })
}

const shouldCoalesceAuthGet = (request: Request) => {
    if (request.method !== "GET") return false
    const requestUrl = new URL(request.url)
    return COALESCED_AUTH_GET_PATHS.has(requestUrl.pathname)
}

const getAuthGetCoalescingKey = (request: Request) => {
    const requestUrl = new URL(request.url)
    if (requestUrl.pathname === "/api/auth/convex/jwks") {
        return `${requestUrl.origin}${requestUrl.pathname}${requestUrl.search}`
    }
    const cookie = request.headers.get("cookie") ?? ""
    const authorization = request.headers.get("authorization") ?? ""
    return `${requestUrl.origin}${requestUrl.pathname}${requestUrl.search}|${cookie}|${authorization}`
}

const getAuthGetCoalescingTtlMs = (request: Request) => {
    const requestUrl = new URL(request.url)
    return requestUrl.pathname === "/api/auth/convex/jwks"
        ? COALESCED_AUTH_JWKS_TTL_MS
        : COALESCED_AUTH_GET_TTL_MS
}

const createResponseSnapshot = async (response: Response): Promise<ResponseSnapshot> => ({
    body: await response.arrayBuffer(),
    headers: Array.from(response.headers.entries()),
    status: response.status,
    statusText: response.statusText
})

const responseFromSnapshot = (snapshot: ResponseSnapshot) =>
    new Response(snapshot.body.slice(0), {
        headers: new Headers(snapshot.headers),
        status: snapshot.status,
        statusText: snapshot.statusText
    })

const proxyAuthGet = async (request: Request) => authServer.handler(withForwardedClientIp(request))

const coalesceAuthGet = async (request: Request) => {
    const cacheKey = getAuthGetCoalescingKey(request)
    const now = Date.now()
    const existing = authGetSnapshotCache.get(cacheKey)
    const ttlMs = getAuthGetCoalescingTtlMs(request)

    if (existing && existing.expiresAt > now) {
        return responseFromSnapshot(await existing.snapshotPromise)
    }

    const snapshotPromise = (async () => createResponseSnapshot(await proxyAuthGet(request)))()
    const expiresAt = now + ttlMs
    authGetSnapshotCache.set(cacheKey, { expiresAt, snapshotPromise })

    try {
        return responseFromSnapshot(await snapshotPromise)
    } catch (error) {
        if (authGetSnapshotCache.get(cacheKey)?.snapshotPromise === snapshotPromise) {
            authGetSnapshotCache.delete(cacheKey)
        }
        throw error
    } finally {
        const cleanupDelayMs = Math.max(0, expiresAt - Date.now())
        setTimeout(() => {
            const current = authGetSnapshotCache.get(cacheKey)
            if (current?.snapshotPromise === snapshotPromise && current.expiresAt <= Date.now()) {
                authGetSnapshotCache.delete(cacheKey)
            }
        }, cleanupDelayMs + 1)
    }
}

export const Route = createFileRoute("/api/auth/$")({
    server: {
        handlers: {
            GET: ({ request }) =>
                shouldCoalesceAuthGet(request) ? coalesceAuthGet(request) : proxyAuthGet(request),
            POST: ({ request }) => authServer.handler(withForwardedClientIp(request))
        }
    }
})

export const ServerRoute = Route
