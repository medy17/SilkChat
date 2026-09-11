import { useAccountStatus } from "@/components/app-boot-provider"
import { useSession } from "@/hooks/auth-hooks"
import {
    type PrototypeCreditPlanSummary,
    readCachedPrototypeCreditValue,
    writeCachedPrototypeCreditValue
} from "@/lib/prototype-credits"
import { useConvexAuth } from "@convex-dev/react-query"
import { useEffect, useMemo } from "react"
import { create } from "zustand"

type CreditAccessState = {
    summary: PrototypeCreditPlanSummary | null
    plan: "free" | "pro" | null
    isStaff: boolean
    isLoading: boolean
}

const initialCreditAccessState: CreditAccessState = {
    summary: null,
    plan: null,
    isStaff: false,
    isLoading: false
}

export const useCreditAccess = create<CreditAccessState>(() => initialCreditAccessState)

export function CreditAccessRuntime() {
    const { data: session } = useSession()
    const auth = useConvexAuth()
    const userId = session?.user?.id
    const cacheKey = userId ? `hosted-usage-plan:v3:${userId}` : "hosted-usage-plan:v3:guest"
    const cachedSummary = useMemo(
        () => readCachedPrototypeCreditValue<PrototypeCreditPlanSummary>(cacheKey),
        [cacheKey]
    )
    const { value: accountStatus, live: liveAccountStatus } = useAccountStatus()
    const liveSummary =
        liveAccountStatus === undefined ? undefined : (liveAccountStatus?.plan ?? null)
    const summary =
        liveSummary === undefined
            ? (accountStatus?.plan ?? cachedSummary?.value ?? null)
            : liveSummary

    const isLoading = Boolean(userId) && (auth.isLoading || liveSummary === undefined) && !summary

    useEffect(() => {
        if (liveSummary) {
            writeCachedPrototypeCreditValue(cacheKey, liveSummary)
        }
    }, [cacheKey, liveSummary])

    const value = useMemo<CreditAccessState>(
        () => ({
            summary,
            plan: summary?.plan ?? (userId && !isLoading ? "free" : null),
            isStaff: summary?.isStaff ?? false,
            isLoading
        }),
        [isLoading, summary, userId]
    )

    useEffect(() => {
        useCreditAccess.setState(value)
    }, [value])

    return null
}
