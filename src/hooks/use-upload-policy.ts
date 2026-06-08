import { api } from "@/convex/_generated/api"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import {
    DEFAULT_UPLOAD_POLICY,
    DEFAULT_UPLOAD_POLICY_VERSION,
    type UploadPolicy
} from "@/lib/file_constants"
import { useCallback, useMemo } from "react"

export type UploadPolicyWithVersion = UploadPolicy & {
    version: string
}

const UPLOAD_POLICY_CACHE_KEY = "attachment-upload-policy"

const DEFAULT_UPLOAD_POLICY_WITH_VERSION: UploadPolicyWithVersion = {
    ...DEFAULT_UPLOAD_POLICY,
    version: DEFAULT_UPLOAD_POLICY_VERSION
}

export const useUploadPolicy = () => {
    const policyResult = useDiskCachedQuery(
        api.attachments.getUploadPolicy,
        {
            key: UPLOAD_POLICY_CACHE_KEY,
            default: DEFAULT_UPLOAD_POLICY_WITH_VERSION,
            forceCache: true
        },
        {}
    ) as UploadPolicyWithVersion

    const invalidateUploadPolicy = useCallback((serverPolicyVersion?: string) => {
        if (typeof window === "undefined") return
        if (!serverPolicyVersion) return

        const cacheKey = `CVX_DISK_CACHE:${UPLOAD_POLICY_CACHE_KEY}`
        const cachedPolicy = localStorage.getItem(cacheKey)
        if (!cachedPolicy) return

        try {
            const parsed = JSON.parse(cachedPolicy) as { version?: string }
            if (parsed.version !== serverPolicyVersion) {
                localStorage.removeItem(cacheKey)
            }
        } catch {
            localStorage.removeItem(cacheKey)
        }
    }, [])

    return useMemo(
        () => ({
            policy: policyResult,
            policyVersion: policyResult.version,
            invalidateUploadPolicy
        }),
        [invalidateUploadPolicy, policyResult]
    )
}
