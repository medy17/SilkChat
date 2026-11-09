// A temporary chat that sits untouched this long is removed by the daily sweep. Leaving it
// in the app removes it straight away; the sweep covers closed tabs and lost connections.
export const TEMPORARY_THREAD_TTL_MS = 24 * 60 * 60 * 1000

export const nextTemporaryExpiry = (now = Date.now()) => now + TEMPORARY_THREAD_TTL_MS

export const isTemporaryThread = (thread: { temporaryExpiresAt?: number }) =>
    thread.temporaryExpiresAt !== undefined
