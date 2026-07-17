export const PAST_DUE_RENEWAL_DISMISSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000

type PastDueRenewalDismissal = {
    subscriptionId: string
    expiresAt: number
}

const getStorageKey = (userId: string) => `past-due-renewal-dismissal:${userId}`

const getBrowserStorage = () => {
    if (typeof window === "undefined") return null

    try {
        return window.localStorage
    } catch {
        return null
    }
}

const readDismissal = ({
    userId,
    storage = getBrowserStorage()
}: {
    userId: string
    storage?: Storage | null
}): PastDueRenewalDismissal | null => {
    if (!storage) return null

    const key = getStorageKey(userId)

    try {
        const value = JSON.parse(storage.getItem(key) ?? "null")
        if (typeof value?.subscriptionId !== "string" || typeof value?.expiresAt !== "number") {
            storage.removeItem(key)
            return null
        }

        return value
    } catch {
        storage.removeItem(key)
        return null
    }
}

export const shouldShowPastDueRenewalNudge = ({
    userId,
    status,
    subscriptionId,
    now = Date.now(),
    storage = getBrowserStorage()
}: {
    userId: string
    status?: string
    subscriptionId?: string
    now?: number
    storage?: Storage | null
}) => {
    if (status !== "past_due" || !subscriptionId) return false

    const dismissal = readDismissal({ userId, storage })
    return !dismissal || dismissal.subscriptionId !== subscriptionId || dismissal.expiresAt <= now
}

export const dismissPastDueRenewalNudge = ({
    userId,
    subscriptionId,
    now = Date.now(),
    storage = getBrowserStorage()
}: {
    userId: string
    subscriptionId: string
    now?: number
    storage?: Storage | null
}) => {
    if (!storage) return

    try {
        storage.setItem(
            getStorageKey(userId),
            JSON.stringify({
                subscriptionId,
                expiresAt: now + PAST_DUE_RENEWAL_DISMISSAL_TTL_MS
            } satisfies PastDueRenewalDismissal)
        )
    } catch {
        // A restricted browser context should not prevent the billing nudge from closing.
    }
}

export const clearPastDueRenewalDismissal = ({
    userId,
    storage = getBrowserStorage()
}: {
    userId: string
    storage?: Storage | null
}) => {
    if (!storage) return

    try {
        storage.removeItem(getStorageKey(userId))
    } catch {
        // Local storage can be unavailable in restricted browser contexts.
    }
}
