import { api } from "@/convex/_generated/api.js"
import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

const usageScenarios = new Set([
    "normal_empty",
    "basic_remaining_zero",
    "basic_near_limit",
    "pro_remaining_zero",
    "pro_near_limit",
    "byok_heavy",
    "internal_heavy",
    "staff_with_limits",
    "staff_with_bypass_limits"
])

const periodAnchorPresets = new Set(["default", "ending_today", "ending_tomorrow"])

type DevCreditStatePayload = {
    plan?: "free" | "pro"
    monthlyBasicCredits?: number
    monthlyProCredits?: number
    isStaff?: boolean
    bypassLimits?: boolean
    usageScenario?: string
    periodAnchorPreset?: string
}

const isDevelopmentRoute = () => process.env.NODE_ENV === "development"

const isValidCreditPlan = (value: unknown): value is "free" | "pro" =>
    value === "free" || value === "pro"

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0

const validatePayload = (body: unknown): DevCreditStatePayload | { error: string } => {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { error: "Invalid JSON body" }
    }

    const input = body as Record<string, unknown>
    const payload: DevCreditStatePayload = {}

    if ("plan" in input) {
        if (!isValidCreditPlan(input.plan)) return { error: "Invalid plan" }
        payload.plan = input.plan
    }

    if ("monthlyBasicCredits" in input) {
        if (!isNonNegativeInteger(input.monthlyBasicCredits)) {
            return { error: "Invalid monthlyBasicCredits" }
        }
        payload.monthlyBasicCredits = input.monthlyBasicCredits
    }

    if ("monthlyProCredits" in input) {
        if (!isNonNegativeInteger(input.monthlyProCredits)) {
            return { error: "Invalid monthlyProCredits" }
        }
        payload.monthlyProCredits = input.monthlyProCredits
    }

    if ("isStaff" in input) {
        if (typeof input.isStaff !== "boolean") return { error: "Invalid isStaff" }
        payload.isStaff = input.isStaff
    }

    if ("bypassLimits" in input) {
        if (typeof input.bypassLimits !== "boolean") return { error: "Invalid bypassLimits" }
        payload.bypassLimits = input.bypassLimits
    }

    if ("usageScenario" in input) {
        if (typeof input.usageScenario !== "string" || !usageScenarios.has(input.usageScenario)) {
            return { error: "Invalid usageScenario" }
        }
        payload.usageScenario = input.usageScenario
    }

    if ("periodAnchorPreset" in input) {
        if (
            typeof input.periodAnchorPreset !== "string" ||
            !periodAnchorPresets.has(input.periodAnchorPreset)
        ) {
            return { error: "Invalid periodAnchorPreset" }
        }
        payload.periodAnchorPreset = input.periodAnchorPreset
    }

    return payload
}

const getCurrentUserOrUnauthorized = async () => {
    const currentUser = await authServer.fetchAuthQuery(api.auth.getCurrentUser)
    return currentUser?.id ? currentUser : null
}

export const Route = createFileRoute("/api/dev/credit-state")({
    server: {
        handlers: {
            GET: async () => {
                if (!isDevelopmentRoute()) {
                    return Response.json({ error: "Not found" }, { status: 404 })
                }

                const currentUser = await getCurrentUserOrUnauthorized()
                if (!currentUser) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                const state = await authServer.fetchAuthQuery(api.credits.getMyDevCreditState)
                if (!state) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                return Response.json(state)
            },
            POST: async ({ request }) => {
                if (!isDevelopmentRoute()) {
                    return Response.json({ error: "Not found" }, { status: 404 })
                }

                const currentUser = await getCurrentUserOrUnauthorized()
                if (!currentUser) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }

                let body: unknown
                try {
                    body = await request.json()
                } catch {
                    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
                }

                const payload = validatePayload(body)
                if ("error" in payload) {
                    return Response.json({ error: payload.error }, { status: 400 })
                }

                try {
                    const state = await authServer.fetchAuthMutation(
                        api.credits.setMyDevCreditState,
                        payload
                    )
                    return Response.json(state)
                } catch (error) {
                    if (error instanceof Error && error.message.includes("Unauthorized")) {
                        return Response.json({ error: "Unauthorized" }, { status: 401 })
                    }
                    throw error
                }
            }
        }
    }
})

export const ServerRoute = Route
