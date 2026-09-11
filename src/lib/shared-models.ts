import { useAppConfiguration } from "@/components/app-boot-provider"
import type { SharedModel } from "@/convex/lib/models"
import { useSession } from "@/hooks/auth-hooks"
import { useMemo } from "react"

const EMPTY_SHARED_MODELS: { version: string; models: SharedModel[] } = {
    version: "",
    models: []
}

export const useSharedModels = () => {
    const { value } = useAppConfiguration()
    const { data: session } = useSession()
    const userId = session?.user?.id
    // Carry forward the existing account-scoped catalog while the first expanded
    // boot response loads, including a frontend/backend update in progress.
    const cached = useMemo(() => {
        try {
            const key = userId ? `shared-models:${userId}` : "shared-models:anon"
            const stored = localStorage.getItem(`CVX_DISK_CACHE:${key}`)
            const parsed = stored ? JSON.parse(stored) : null
            return parsed && typeof parsed.version === "string" && Array.isArray(parsed.models)
                ? (parsed as typeof EMPTY_SHARED_MODELS)
                : EMPTY_SHARED_MODELS
        } catch {
            return EMPTY_SHARED_MODELS
        }
    }, [userId])
    return value?.sharedModels ?? cached
}
