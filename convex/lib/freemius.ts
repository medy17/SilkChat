import type { MutationCtx, QueryCtx } from "../_generated/server"
import type { BillingPlan } from "./lemon_squeezy"

// Freemius webhooks are treated as "this customer changed" signals only. We never
// trust an event's contents or arrival order: every relevant event resyncs the
// Freemius user's current licenses from the API, and that snapshot is stored.

const SYNC_EVENT_PREFIXES = ["license.", "subscription.", "payment."]

export const isFreemiusSyncEvent = (eventType: string) =>
    SYNC_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix))

export type FreemiusWebhookEvent = {
    eventId: string
    eventType: string
    fsUserId?: string
}

export type FreemiusLicenseSnapshot = {
    fsLicenseId: string
    fsPlanId: string
    fsPricingId?: string
    expiresAt?: number
    isCancelled: boolean
    isSandbox: boolean
}

const getObject = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined

const getId = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "string" && value.trim()) return value.trim()
    return undefined
}

export const parseFreemiusWebhookEvent = (payload: unknown): FreemiusWebhookEvent | null => {
    const root = getObject(payload)
    const eventId = getId(root?.id)
    const eventType = typeof root?.type === "string" ? root.type : undefined
    if (!root || !eventId || !eventType) return null

    const objects = getObject(root.objects)
    const fsUserId =
        getId(root.user_id) ??
        getId(getObject(objects?.user)?.id) ??
        getId(getObject(objects?.license)?.user_id) ??
        getId(getObject(objects?.subscription)?.user_id) ??
        getId(getObject(objects?.payment)?.user_id)

    return { eventId, eventType, fsUserId }
}

// Freemius dates are UTC "YYYY-MM-DD HH:MM:SS" strings.
const parseFreemiusDate = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return undefined
    const timestamp = Date.parse(`${value.trim().replace(" ", "T")}Z`)
    return Number.isFinite(timestamp) ? timestamp : undefined
}

export const parseFreemiusLicense = (value: unknown): FreemiusLicenseSnapshot | null => {
    const license = getObject(value)
    const fsLicenseId = getId(license?.id)
    const fsPlanId = getId(license?.plan_id)
    if (!license || !fsLicenseId || !fsPlanId) return null

    return {
        fsLicenseId,
        fsPlanId,
        fsPricingId: getId(license.pricing_id),
        // A null expiration is a lifetime license.
        expiresAt: parseFreemiusDate(license.expiration),
        isCancelled: license.is_cancelled === true || license.is_cancelled === 1,
        isSandbox: Number(license.environment) === 1
    }
}

export const isFreemiusLicenseActive = (
    license: Pick<FreemiusLicenseSnapshot, "expiresAt" | "isCancelled" | "isSandbox">,
    now: number,
    { allowSandbox }: { allowSandbox: boolean }
) =>
    !license.isCancelled &&
    (allowSandbox || !license.isSandbox) &&
    (license.expiresAt === undefined || license.expiresAt > now)

export const getFreemiusPlan = (
    licenses: readonly Pick<FreemiusLicenseSnapshot, "expiresAt" | "isCancelled" | "isSandbox">[],
    now: number,
    options: { allowSandbox: boolean }
): BillingPlan =>
    licenses.some((license) => isFreemiusLicenseActive(license, now, options)) ? "pro" : "free"

// Sandbox purchases only count where explicitly enabled (dev and staging).
export const freemiusAllowsSandbox = () => process.env.FREEMIUS_ALLOW_SANDBOX?.trim() === "1"

export const getFreemiusPlanForUser = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    now: number
) => {
    const licenses = await ctx.db
        .query("freemiusLicenses")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .collect()

    return getFreemiusPlan(licenses, now, { allowSandbox: freemiusAllowsSandbox() })
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

// Freemius signs the raw body with HMAC-SHA256 using the product secret key.
export const verifyFreemiusSignature = async ({
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

    return timingSafeEqual(toHex(digest), signature.trim().toLowerCase())
}

export type FreemiusUserState = {
    email?: string
    licenses: FreemiusLicenseSnapshot[]
}

const FREEMIUS_API_BASE = "https://api.freemius.com/v1"

// Reads the user's current state straight from Freemius. This is the only source
// of truth for entitlements; webhook payloads are never stored as state.
export const fetchFreemiusUserState = async (fsUserId: string): Promise<FreemiusUserState> => {
    const productId = process.env.FREEMIUS_PRODUCT_ID?.trim()
    const apiToken = process.env.FREEMIUS_API_TOKEN?.trim()
    if (!productId || !apiToken) {
        throw new Error("Freemius API credentials are not configured")
    }

    const request = async (path: string) => {
        const response = await fetch(`${FREEMIUS_API_BASE}/products/${productId}${path}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${apiToken}`
            }
        })
        if (!response.ok) {
            throw new Error(`Freemius API ${path} failed: ${response.status}`)
        }
        return (await response.json()) as unknown
    }

    const userPath = `/users/${encodeURIComponent(fsUserId)}`
    const [user, licenseList] = await Promise.all([
        request(`${userPath}.json`),
        request(`${userPath}/licenses.json?count=50`)
    ])

    const email = getObject(user)?.email
    const licenses = getObject(licenseList)?.licenses

    return {
        email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined,
        licenses: Array.isArray(licenses)
            ? licenses
                  .map(parseFreemiusLicense)
                  .filter((license): license is FreemiusLicenseSnapshot => license !== null)
            : []
    }
}
