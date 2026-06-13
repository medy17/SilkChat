export type BillingPlan = "free" | "pro"

export type LemonSqueezyWebhookSummary = {
    eventId: string
    eventName: string
    userId?: string
    subscriptionId?: string
    customerId?: string
    orderId?: string
    productId?: string
    variantId?: string
    status?: string
    plan?: BillingPlan
    renewsAt?: string
    endsAt?: string
    trialEndsAt?: string
}

type LemonSqueezyPayload = {
    meta?: {
        event_name?: unknown
        custom_data?: unknown
        webhook_id?: unknown
    }
    data?: {
        id?: unknown
        type?: unknown
        attributes?: Record<string, unknown>
    }
}

const PRO_SUBSCRIPTION_STATUSES = new Set([
    "active",
    "cancelled",
    "on_trial",
    "past_due",
    "paused",
    "unpaid"
])
const FREE_SUBSCRIPTION_STATUSES = new Set(["expired"])

const getString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : undefined

const getNestedObject = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined

const getStringFromObject = (object: Record<string, unknown> | undefined, key: string) =>
    object ? getString(object[key]) : undefined

const getPlanFromStatus = (status: string | undefined): BillingPlan | undefined => {
    if (!status) return undefined
    if (PRO_SUBSCRIPTION_STATUSES.has(status)) return "pro"
    if (FREE_SUBSCRIPTION_STATUSES.has(status)) return "free"
    return undefined
}

export const isLemonSqueezySubscriptionEvent = (eventName: string) =>
    eventName === "subscription_created" ||
    eventName === "subscription_updated" ||
    eventName === "subscription_cancelled" ||
    eventName === "subscription_resumed" ||
    eventName === "subscription_expired" ||
    eventName === "subscription_paused" ||
    eventName === "subscription_unpaused"

export const parseLemonSqueezyWebhookPayload = (
    payload: unknown
): LemonSqueezyWebhookSummary | null => {
    const root = getNestedObject(payload) as LemonSqueezyPayload | undefined
    const eventName = getString(root?.meta?.event_name)
    const data = getNestedObject(root?.data)
    const attributes = getNestedObject(root?.data?.attributes)

    if (!eventName || !data || !attributes) {
        return null
    }

    const customData =
        getNestedObject(root?.meta?.custom_data) ?? getNestedObject(attributes.custom_data)
    const firstOrderItem = getNestedObject(attributes.first_order_item)
    const urls = getNestedObject(attributes.urls)
    const subscriptionId = getString(data.id) ?? getStringFromObject(attributes, "subscription_id")
    const customerId = getStringFromObject(attributes, "customer_id")
    const orderId = getStringFromObject(attributes, "order_id")
    const productId =
        getStringFromObject(attributes, "product_id") ??
        getStringFromObject(firstOrderItem, "product_id")
    const variantId =
        getStringFromObject(attributes, "variant_id") ??
        getStringFromObject(firstOrderItem, "variant_id")
    const status = getStringFromObject(attributes, "status")
    const eventId =
        getString(root?.meta?.webhook_id) ??
        getStringFromObject(attributes, "event_id") ??
        `${eventName}:${subscriptionId ?? orderId ?? customerId ?? "unknown"}`

    return {
        eventId,
        eventName,
        userId:
            getStringFromObject(customData, "user_id") ??
            getStringFromObject(customData, "userId") ??
            getStringFromObject(attributes, "user_id"),
        subscriptionId,
        customerId,
        orderId,
        productId,
        variantId,
        status,
        plan: getPlanFromStatus(status),
        renewsAt: getStringFromObject(attributes, "renews_at"),
        endsAt: getStringFromObject(attributes, "ends_at"),
        trialEndsAt:
            getStringFromObject(attributes, "trial_ends_at") ??
            getStringFromObject(urls, "trial_ends_at")
    }
}

const toHex = (bytes: ArrayBuffer) =>
    Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")

const timingSafeEqual = (left: string, right: string) => {
    if (left.length !== right.length) return false

    let diff = 0
    for (let index = 0; index < left.length; index += 1) {
        diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
    }
    return diff === 0
}

export const verifyLemonSqueezySignature = async ({
    rawBody,
    secret,
    signature
}: {
    rawBody: string
    secret: string
    signature: string | null
}) => {
    if (!secret || !signature) return false

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody))

    return timingSafeEqual(toHex(digest), signature.toLowerCase())
}
