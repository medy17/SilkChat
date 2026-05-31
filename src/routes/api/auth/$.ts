import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

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

export const Route = createFileRoute("/api/auth/$")({
    server: {
        handlers: {
            GET: ({ request }) => authServer.handler(withForwardedClientIp(request)),
            POST: ({ request }) => authServer.handler(withForwardedClientIp(request))
        }
    }
})

export const ServerRoute = Route
