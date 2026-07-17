const getStorageKey = (userId: string) => `pro-welcome-dismissal:${userId}`

export const PRO_WELCOME_ELIGIBILITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const getBrowserStorage = () => {
    if (typeof window === "undefined") return null

    try {
        return window.localStorage
    } catch {
        return null
    }
}

export const shouldShowProWelcome = ({
    plan,
    status,
    subscriptionId,
    createdAt,
    userId,
    now = Date.now(),
    storage = getBrowserStorage()
}: {
    plan: string
    status?: string
    subscriptionId?: string
    createdAt?: number
    userId: string
    now?: number
    storage?: Storage | null
}) => {
    if (
        plan !== "pro" ||
        status !== "active" ||
        !subscriptionId ||
        typeof createdAt !== "number" ||
        now - createdAt >= PRO_WELCOME_ELIGIBILITY_WINDOW_MS
    ) {
        return false
    }
    if (!storage) return true

    try {
        return storage.getItem(getStorageKey(userId)) !== subscriptionId
    } catch {
        return true
    }
}

export const dismissProWelcome = ({
    userId,
    subscriptionId,
    storage = getBrowserStorage()
}: {
    userId: string
    subscriptionId: string
    storage?: Storage | null
}) => {
    if (!storage) return

    try {
        storage.setItem(getStorageKey(userId), subscriptionId)
    } catch {
        // A restricted browser context should not prevent the welcome from closing.
    }
}
