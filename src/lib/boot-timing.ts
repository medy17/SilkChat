export type BootSettledKind = "landing" | "chat" | "chat-timeout"

export const BOOT_SETTLED_MARK = "silkchat:boot-settled"

let hasMarked = false

/**
 * Records when the first screen settled (landing shown, or the chat revealed from under its
 * skeleton), measured from navigation start. Read it in DevTools as the
 * `silkchat:boot-settled` performance mark; dev builds also log it.
 */
export const markBootSettled = (kind: BootSettledKind) => {
    if (hasMarked || typeof performance === "undefined") return
    hasMarked = true

    try {
        performance.mark(BOOT_SETTLED_MARK, { detail: { kind } })
    } catch {}

    if (import.meta.env.DEV) {
        console.info(`[boot] ${kind} settled at ${Math.round(performance.now())}ms`)
    }
}
