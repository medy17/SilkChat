import { flushSync } from "react-dom"
import { create } from "zustand"
import { authClient } from "./auth-client"
import {
    ACCOUNT_STORAGE_OWNER,
    ACCOUNT_SWITCH_EVENT,
    clearAccountSessionStorage,
    switchAccountStorage
} from "./impersonation-storage"

export const useAccountSwitch = create<{ switching: boolean; error: string | null }>(() => ({
    switching: false,
    error: null
}))

export const switchImpersonation = async (previousId: string, targetId?: string) => {
    if (useAccountSwitch.getState().switching) return
    // Unmount account views before cookies change so old subscriptions cannot paint or
    // persist data under the next identity. Other open tabs follow the same transition.
    flushSync(() => useAccountSwitch.setState({ switching: true, error: null }))
    const announce = (state: "switching" | "complete" | "failed") => {
        localStorage.setItem(
            ACCOUNT_SWITCH_EVENT,
            JSON.stringify({ state, nonce: crypto.randomUUID() })
        )
    }
    let attempted = false
    try {
        localStorage.setItem(ACCOUNT_STORAGE_OWNER, previousId)
        announce("switching")
        attempted = true
        const result = targetId
            ? await authClient.admin.impersonateUser({ userId: targetId })
            : await authClient.admin.stopImpersonating()
        if (result.error) {
            if (result.error.status < 400 || result.error.status >= 500) {
                throw new Error(result.error.message || "Could not switch accounts")
            }
            // A definite rejection leaves the original account usable. Transport failures
            // take the catch path below because the server may already have switched.
            announce("failed")
            useAccountSwitch.setState({ switching: false })
            return Promise.reject(new Error(result.error.message || "Could not switch accounts"))
        }
        switchAccountStorage(localStorage, previousId, result.data.user.id)
        clearAccountSessionStorage(sessionStorage)
        announce("complete")
        window.location.replace("/")
    } catch (error) {
        try {
            announce("failed")
        } catch {
            /* Storage itself may be unavailable. */
        }
        useAccountSwitch.setState({
            switching: attempted,
            error: attempted
                ? "Could not finish switching accounts. Reload to check your session."
                : null
        })
        throw error
    }
}
