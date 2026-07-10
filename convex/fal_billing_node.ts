"use node"

import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"
import { resolveFalBillingEventMicrousd } from "./lib/usage_metering"

const FAL_BILLING_EVENTS_URL = "https://api.fal.ai/v1/models/billing-events"
const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000]

const getFalAdminAuthorization = () => {
    const key = process.env.FAL_ADMIN_API_KEY?.trim() || process.env.FAL_KEY?.trim()
    if (!key) return null
    return key.startsWith("Key ") ? key : `Key ${key}`
}

export const reconcileFalUsageCost = internalAction({
    args: {
        userId: v.string(),
        messageKey: v.string(),
        requestId: v.string(),
        attempt: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const attempt = Math.max(0, Math.floor(args.attempt ?? 0))
        const authorization = getFalAdminAuthorization()
        if (!authorization) {
            console.error("[fal billing] reconciliation disabled: FAL key is missing", {
                requestId: args.requestId,
                messageKey: args.messageKey
            })
            return { reconciled: false, retryScheduled: false, reason: "missing_key" }
        }
        const url = new URL(FAL_BILLING_EVENTS_URL)
        url.searchParams.set("request_id", args.requestId)
        url.searchParams.set("limit", "10")

        try {
            const response = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    Authorization: authorization
                }
            })
            if (response.status === 401 || response.status === 403) {
                console.error("[fal billing] API key is not authorized for billing events", {
                    status: response.status,
                    requestId: args.requestId,
                    messageKey: args.messageKey
                })
                return { reconciled: false, retryScheduled: false, reason: "unauthorized" }
            }
            if (!response.ok) {
                throw new Error(`Fal billing-events fetch failed: ${response.status}`)
            }

            const payload: unknown = await response.json()
            const settledMicrousd = resolveFalBillingEventMicrousd(payload, args.requestId)
            if (settledMicrousd !== undefined) {
                await ctx.runMutation(internal.credits.reconcileSettledUsageCost, {
                    userId: args.userId,
                    messageKey: args.messageKey,
                    providerRequestId: args.requestId,
                    settledMicrousd,
                    pricingSource: "fal_reported"
                })
                return { reconciled: true, settledMicrousd }
            }

            console.error("[fal billing] billing event not available yet", {
                requestId: args.requestId,
                messageKey: args.messageKey,
                attempt,
                payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : []
            })
        } catch (error) {
            console.error("[fal billing] reconciliation attempt failed", {
                requestId: args.requestId,
                messageKey: args.messageKey,
                attempt,
                error
            })
        }

        const delay = RETRY_DELAYS_MS[attempt]
        if (delay !== undefined) {
            await ctx.scheduler.runAfter(delay, internal.fal_billing_node.reconcileFalUsageCost, {
                userId: args.userId,
                messageKey: args.messageKey,
                requestId: args.requestId,
                attempt: attempt + 1
            })
        }

        return { reconciled: false, retryScheduled: delay !== undefined, reason: "not_found" }
    }
})
