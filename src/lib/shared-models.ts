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
    // A boot session still in flight counts too, so the flag goes true -> false once rather
    // than briefly settling on a cached signed-out list before the account is known.
    const isAwaitingAccountList = (Boolean(session.user?.id) || session.isPending) && auth.isLoading
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
        // Still on the signed-out list while Convex auth settles, or nothing cached or
        // loaded yet. Callers hold placeholders rather than render a list that will change.
        const isPending = isAwaitingAccountList || (!("error" in result) && !result.version)
        if ("error" in result) return { ...EMPTY_SHARED_MODELS, isPending }
        // Disk-cached payloads from before the policy shipped don't carry it.
        return {
            ...result,
            hostedContextPolicy: result.hostedContextPolicy ?? DEFAULT_HOSTED_CONTEXT_POLICY,
            isPending
        }
    }, [isAwaitingAccountList, result])
}
