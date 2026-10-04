import { api } from "@/convex/_generated/api.js"
import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

// Retired: displaying a saved answer must never start a quota-consuming search.
export const Route = createFileRoute("/api/visual-references")({
    server: {
        handlers: {
            GET: async () => {
                const user = await authServer.fetchAuthQuery(api.auth.getCurrentUser)
                return Response.json(
                    {
                        error: user
                            ? "Visuals are resolved with the response. Reload the app to update."
                            : "Unauthorized"
                    },
                    { status: user ? 410 : 401, headers: { "Cache-Control": "no-store" } }
                )
            }
        }
    }
})
export const ServerRoute = Route
