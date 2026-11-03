import { api } from "@/convex/_generated/api"
import {
    DEFAULT_HOSTED_CONTEXT_POLICY,
    type HostedContextPolicy
} from "@/convex/lib/context_limits"
import type { SharedModel } from "@/convex/lib/models"
import { useSession } from "@/hooks/auth-hooks"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { useConvexAuth } from "@convex-dev/react-query"
import { useMemo } from "react"

const EMPTY_SHARED_MODELS: {
    version: string
    models: SharedModel[]
    hostedContextPolicy: HostedContextPolicy
} = {
    version: "",
    models: [],
    hostedContextPolicy: DEFAULT_HOSTED_CONTEXT_POLICY
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

    return useMemo(() => {
        if ("error" in result) return EMPTY_SHARED_MODELS
        // Disk-cached payloads from before the policy shipped don't carry it.
        return {
            ...result,
            hostedContextPolicy: result.hostedContextPolicy ?? DEFAULT_HOSTED_CONTEXT_POLICY
        }
    }, [result])
}
