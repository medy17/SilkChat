import { api } from "@/convex/_generated/api.js"
import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

const isValidCreditPlan = (value: unknown): value is "free" | "pro" =>
    value === "free" || value === "pro"

export const Route = createFileRoute("/api/dev/credit-plan")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                if (process.env.NODE_ENV !== "development") {
                    return Response.json({ error: "Not found" }, { status: 404 })
                }

                const currentUser = await authServer.api.getSession({
                    headers: request.headers
                })

                if (!currentUser?.id) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                let body: { plan?: unknown }
                try {
                    body = (await request.json()) as { plan?: unknown }
                } catch {
                    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
                }

                if (!isValidCreditPlan(body.plan)) {
                    return Response.json({ error: "Invalid plan" }, { status: 400 })
                }

                let account: { plan: "free" | "pro" }
                try {
                    account = await authServer.fetchAuthMutation(
                        api.credits.setMyPrototypeCreditPlan,
                        {
                            plan: body.plan
                        }
                    )
                } catch {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                return Response.json({
                    ok: true,
                    plan: account.plan
                })
            }
        }
    }
})

export const ServerRoute = Route
