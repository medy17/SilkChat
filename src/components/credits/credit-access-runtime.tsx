import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import {
    type PrototypeCreditPlanSummary,
    readCachedPrototypeCreditValue,
    writeCachedPrototypeCreditValue
} from "@/lib/prototype-credits"
import { useConvexAuth } from "@convex-dev/react-query"
import { useQuery } from "convex-helpers/react/cache"
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
    const liveSummary = useQuery(
        api.credits.getMyCreditPlanSummary,
        userId && !auth.isLoading ? {} : "skip"
    )
    const summary =
        liveSummary === undefined ? (cachedSummary?.value ?? null) : (liveSummary ?? null)
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
