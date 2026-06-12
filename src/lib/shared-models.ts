import { api } from "@/convex/_generated/api"
import type { SharedModel } from "@/convex/lib/models"
import { useSession } from "@/hooks/auth-hooks"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { useConvexAuth } from "@convex-dev/react-query"
import { useMemo } from "react"

const EMPTY_SHARED_MODELS: { version: string; models: SharedModel[] } = {
    version: "",
    models: []
}

export const useSharedModels = () => {
    const auth = useConvexAuth()
    const session = useSession()
    const result = useDiskCachedQuery(
        api.settings.getSharedModels,
        {
            key:
                session.user?.id && !auth.isLoading
                    ? `shared-models:${session.user.id}`
                    : "shared-models:anon",
            default: EMPTY_SHARED_MODELS,
            forceCache: true
        },
        {}
    )

    return useMemo(() => ("error" in result ? EMPTY_SHARED_MODELS : result), [result])
}
