import { optionalBrowserEnv } from "@/lib/browser-env"

const SIGNUP_CONVERSION_DEDUPE_PREFIX = "google-ads:signup-conversion"
const RECENT_SIGNUP_WINDOW_MS = 15 * 60 * 1000
const trackedSignupConversions = new Set<string>()

type GoogleAdsUser = {
    id?: unknown
    createdAt?: unknown
}

type GoogleTag = (
    command: "event",
    action: "conversion",
    params: {
        send_to: string
        value: number
        currency: string
    }
) => void

declare global {
    interface Window {
        gtag?: GoogleTag
    }
}

const parseCreatedAt = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value
    }

    if (value instanceof Date) {
        return value.getTime()
    }

    if (typeof value === "string") {
        const parsed = Date.parse(value)
        return Number.isFinite(parsed) ? parsed : null
    }

    return null
}

const getSignupConversionKey = (sendTo: string, userId: string) =>
    `${SIGNUP_CONVERSION_DEDUPE_PREFIX}:${sendTo}:${userId}`

export function trackGoogleAdsSignupConversion(user: GoogleAdsUser | null | undefined) {
    if (typeof window === "undefined" || !user) {
        return false
    }

    const userId = typeof user.id === "string" ? user.id.trim() : ""
    const createdAt = parseCreatedAt(user.createdAt)

    if (!userId || !createdAt || Date.now() - createdAt > RECENT_SIGNUP_WINDOW_MS) {
        return false
    }

    const googleAdsId = optionalBrowserEnv("VITE_GOOGLE_ADS_ID")
    const conversionLabel = optionalBrowserEnv("VITE_GOOGLE_SIGNUP_CONVERSION_LABEL")

    if (!googleAdsId || !conversionLabel || typeof window.gtag !== "function") {
        return false
    }

    const sendTo = `${googleAdsId}/${conversionLabel}`
    const conversionKey = getSignupConversionKey(sendTo, userId)

    if (trackedSignupConversions.has(conversionKey)) {
        return false
    }

    try {
        if (window.localStorage.getItem(conversionKey)) {
            trackedSignupConversions.add(conversionKey)
            return false
        }
    } catch {
        // localStorage can be unavailable in private or restricted browser contexts.
    }

    window.gtag("event", "conversion", {
        send_to: sendTo,
        value: 1.0,
        currency: "MYR"
    })

    trackedSignupConversions.add(conversionKey)

    try {
        window.localStorage.setItem(conversionKey, String(Date.now()))
    } catch {
        // Best-effort dedupe; the in-memory set still prevents duplicate fires in this tab.
    }

    return true
}
