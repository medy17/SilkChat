import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"
import { parseLemonSqueezyWebhookPayload, verifyLemonSqueezySignature } from "./lib/lemon_squeezy"

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    })

export const lemonSqueezyWebhook = httpAction(async (ctx, request) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()
    if (!secret) {
        return jsonResponse({ error: "Lemon Squeezy webhook secret is not configured" }, 400)
    }

    const rawBody = await request.text()
    const signature = request.headers.get("X-Signature")
    const isVerified = await verifyLemonSqueezySignature({
        rawBody,
        secret,
        signature
    })

    if (!isVerified) {
        return jsonResponse({ error: "Invalid signature" }, 401)
    }

    let payload: unknown
    try {
        payload = JSON.parse(rawBody)
    } catch {
        return jsonResponse({ error: "Invalid JSON payload" }, 400)
    }

    if (!parseLemonSqueezyWebhookPayload(payload)) {
        return jsonResponse({ error: "Invalid Lemon Squeezy payload" }, 400)
    }

    const result = await ctx.runMutation(internal.billing.recordLemonSqueezyWebhook, {
        payload
    })

    return jsonResponse({ ok: true, result })
})
