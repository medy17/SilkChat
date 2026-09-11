import { useAppConfiguration } from "@/components/app-boot-provider"
import {
    DEFAULT_UPLOAD_POLICY,
    DEFAULT_UPLOAD_POLICY_VERSION,
    type UploadPolicy
} from "@/lib/file_constants"
import { useCallback, useMemo } from "react"

export type UploadPolicyWithVersion = UploadPolicy & {
    version: string
}

const DEFAULT_UPLOAD_POLICY_WITH_VERSION: UploadPolicyWithVersion = {
    ...DEFAULT_UPLOAD_POLICY,
    version: DEFAULT_UPLOAD_POLICY_VERSION
}

export const useUploadPolicy = () => {
    const { value } = useAppConfiguration()
    const policyResult = value?.uploadPolicy ?? DEFAULT_UPLOAD_POLICY_WITH_VERSION
    const cacheKey = `CVX_DISK_CACHE:app-configuration:v1:${value?.userId ?? "guest"}`

    const invalidateUploadPolicy = useCallback(
        (serverPolicyVersion?: string) => {
            if (typeof window === "undefined") return
            if (!serverPolicyVersion) return

            const cachedPolicy = localStorage.getItem(cacheKey)
            if (!cachedPolicy) return

            try {
                const parsed = JSON.parse(cachedPolicy) as { uploadPolicy?: { version?: string } }
                if (parsed.uploadPolicy?.version !== serverPolicyVersion) {
                    localStorage.removeItem(cacheKey)
                }
            } catch {
                localStorage.removeItem(cacheKey)
            }
        },
        [cacheKey]
    )

    return useMemo(
        () => ({
            policy: policyResult,
            policyVersion: policyResult.version,
            invalidateUploadPolicy
        }),
        [invalidateUploadPolicy, policyResult]
    )
}
