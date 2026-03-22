import { api } from "@/convex/_generated/api"
import type { SharedModel } from "@/convex/lib/models"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { useMemo } from "react"

const EMPTY_SHARED_MODELS: { version: string; models: SharedModel[] } = {
    version: "",
    models: []
}

export const useSharedModels = () => {
    const result = useDiskCachedQuery(
        api.settings.getSharedModels,
        {
            key: "shared-models",
            default: EMPTY_SHARED_MODELS,
            forceCache: true
        },
        {}
    )

    return useMemo(() => ("error" in result ? EMPTY_SHARED_MODELS : result), [result])
}
