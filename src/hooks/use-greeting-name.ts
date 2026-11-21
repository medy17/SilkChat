import { api } from "@/convex/_generated/api"
import { useQuery } from "convex-helpers/react/cache"
import { useEffect, useMemo } from "react"

const STORAGE_KEY = "DISK_CACHE:greeting-name"
const LEGACY_STORAGE_KEY = "DISK_CACHE:user-name"

type CachedGreetingName = { userId: string; name: string | null }

const readCache = (): CachedGreetingName | null => {
    try {
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (typeof parsed?.userId !== "string") return null
        return {
            userId: parsed.userId,
            name: typeof parsed.name === "string" ? parsed.name : null
        }
    } catch {
        return null
    }
}

/**
 * The name the new-chat greeting uses: the Customization name as written, falling back to
 * the account's first name. `undefined` means the source isn't known yet, so the greeting
 * waits instead of showing one name and swapping to the other. The last answer is cached
 * so returning sessions show it straight away.
 */
export function useGreetingName(
    userId: string | undefined,
    accountName: string | undefined,
    isPending: boolean
): string | null | undefined {
    const settings = useQuery(api.settings.getUserSettings, userId && !isPending ? {} : "skip")
    const cached = useMemo(readCache, [])

    const resolved =
        userId && settings
            ? settings.customization?.name?.trim() || accountName?.trim().split(" ")[0] || null
            : undefined

    useEffect(() => {
        if (!userId || resolved === undefined) return
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, name: resolved }))
        } catch {}
    }, [userId, resolved])

    if (resolved !== undefined) return resolved
    // While the session loads the account isn't known yet; once it is, another account's
    // cached name is ignored.
    if (cached && (isPending || cached.userId === userId)) return cached.name
    return undefined
}
