import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/auth/$")({
    server: {
        handlers: {
            GET: ({ request }) => authServer.handler(request),
            POST: ({ request }) => authServer.handler(request)
        }
    }
})

export const ServerRoute = Route
