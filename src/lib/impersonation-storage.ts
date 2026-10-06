export const ACCOUNT_SWITCH_EVENT = "silkchat:account-switch"
export const ACCOUNT_STORAGE_OWNER = "silkchat:account-storage-owner"
const snapshotKey = (userId: string) => `silkchat:account-browser-state:${userId}`
const TRANSITION_KEY = "silkchat:account-storage-transition"

const accountKeys = new Set([
    "model-storage",
    "ai-config",
    "user-input",
    "silkchat:thread-drafts:v1",
    "project-selection",
    "library-generation-store",
    "library-private-viewing-store"
])

export const clearAccountSessionStorage = (storage: Storage) => {
    for (const key of ["last-chat-route", "last-library-route", "persona-onboarding-handoff"]) {
        storage.removeItem(key)
    }
}

// Preserve drafts and browser preferences for each account, but discard query caches.
// Call only with the IDs returned by successful auth operations, then reload to reset
// in-memory stores, router loaders, queries, and Convex subscriptions together.
export const switchAccountStorage = (storage: Storage, previousId: string, nextId: string) => {
    if (previousId === nextId) return
    const previous = Object.fromEntries(
        [...accountKeys].flatMap((key) => {
            const value = storage.getItem(key)
            return value === null ? [] : [[key, value]]
        })
    )
    const transition = JSON.stringify([previousId, nextId])
    if (storage.getItem(TRANSITION_KEY) !== transition) {
        storage.setItem(snapshotKey(previousId), JSON.stringify(previous))
        storage.setItem(TRANSITION_KEY, transition)
    }
    const saved = storage.getItem(snapshotKey(nextId))
    let next: Record<string, unknown> = {}
    try {
        const parsed: unknown = saved ? JSON.parse(saved) : null
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            next = parsed as Record<string, unknown>
        }
    } catch {
        // A corrupt saved preference must not leave another account's state active.
    }
    for (const key of Object.keys(storage)) {
        if (
            key.startsWith("CVX_DISK_CACHE:") ||
            key.startsWith("DISK_CACHE:") ||
            key.startsWith("prototype-credit-") ||
            key.startsWith("hosted-usage")
        )
            storage.removeItem(key)
    }
    for (const key of accountKeys) {
        if (typeof next[key] === "string") storage.setItem(key, next[key])
        else storage.removeItem(key)
    }
    storage.setItem(ACCOUNT_STORAGE_OWNER, nextId)
    storage.removeItem(TRANSITION_KEY)
}
