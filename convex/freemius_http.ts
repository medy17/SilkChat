import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"
import {
    isFreemiusSyncEvent,
    parseFreemiusWebhookEvent,
    verifyFreemiusSignature
} from "./lib/freemius"

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    })

export const freemiusWebhook = httpAction(async (ctx, request) => {
    const secret = process.env.FREEMIUS_SECRET_KEY?.trim()
    if (!secret) {
        return jsonResponse({ error: "Freemius secret key is not configured" }, 400)
    }

    const rawBody = await request.text()
    const isVerified = await verifyFreemiusSignature({
        rawBody,
        secret,
        signature: request.headers.get("x-signature")
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

    const event = parseFreemiusWebhookEvent(payload)
    if (!event) {
        return jsonResponse({ error: "Invalid Freemius payload" }, 400)
    }
    if (!isFreemiusSyncEvent(event.eventType) || !event.fsUserId) {
        return jsonResponse({ ok: true, status: "ignored", eventId: event.eventId })
    }

    try {
        const result = await ctx.runAction(internal.freemius.syncFreemiusUser, {
            fsUserId: event.fsUserId
        })
        return jsonResponse({ ok: true, eventId: event.eventId, result })
    } catch (error) {
        console.error("[freemius] sync failed", {
            eventId: event.eventId,
            eventType: event.eventType,
            error: error instanceof Error ? error.message : String(error)
        })
        // A non-2xx makes Freemius retry, and the retry resyncs from scratch.
        return jsonResponse({ error: "Sync failed" }, 502)
    }
})
