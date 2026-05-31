import { api } from "@/convex/_generated/api.js"
import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/credit-summary")({
    server: {
        handlers: {
            GET: async () => {
                const summary = await authServer.fetchAuthQuery(api.credits.getMyCreditSummary)

                if (!summary) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                return Response.json(summary)
            }
        }
    }
})

export const ServerRoute = Route
