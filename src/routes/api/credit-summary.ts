import { auth } from "@/lib/auth"
import { getConfiguredCreditLimits, getUserCreditPlan } from "@/lib/user-subscription"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/credit-summary")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const session = await auth.api.getSession({
                    headers: request.headers
                })

                if (!session?.user?.id) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                const plan = await getUserCreditPlan(session.user.id)
                const limits = getConfiguredCreditLimits(plan)

                return Response.json({
                    enabled: true,
                    plan,
                    basic: {
                        limit: limits.basic
                    },
                    pro: {
                        limit: limits.pro
                    }
                })
            }
        }
    }
})

export const ServerRoute = Route
