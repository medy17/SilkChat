export const MAX_PERSISTENT_SANDBOX_LIFETIME_MS = 30 * 60_000
export const PERSISTENT_SANDBOX_IDLE_SUSPEND_MS = 90_000
export const PERSISTENT_SANDBOX_CONFIRMATION_TTL_MS = 10 * 60_000

export const isPastPersistentSandboxLifetime = (createdAt: number, now: number) =>
    createdAt <= now - MAX_PERSISTENT_SANDBOX_LIFETIME_MS
