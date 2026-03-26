import { auth } from "@/lib/auth"
import { type UserCreditPlan, setUserCreditPlan } from "@/lib/user-subscription"
import { createFileRoute } from "@tanstack/react-router"

const isValidCreditPlan = (value: unknown): value is UserCreditPlan =>
    value === "free" || value === "pro"

export const Route = createFileRoute("/api/dev/credit-plan")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                if (process.env.NODE_ENV !== "development") {
                    return Response.json({ error: "Not found" }, { status: 404 })
                }

                const session = await auth.api.getSession({
                    headers: request.headers
                })

                if (!session?.user?.id) {
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

                const plan = await setUserCreditPlan(session.user.id, body.plan)

                return Response.json({
                    ok: true,
                    plan
                })
            }
        }
    }
})

export const ServerRoute = Route
