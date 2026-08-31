import { api } from "@/convex/_generated/api"
import { useCreditAccess } from "@/components/credits/credit-access-runtime"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import {
    type PrototypeCreditDevState,
    type PrototypeCreditDevStatePayload,
    type PrototypeCreditSummary,
    type PrototypeCreditUsageSummary,
    buildPrototypeCreditSummary,
    readCachedPrototypeCreditValue,
    writeCachedPrototypeCreditValue
} from "@/lib/prototype-credits"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const MIN_REFRESH_VISIBLE_MS = 700

type UsePrototypeCreditsOptions = {
    userId: string | undefined
    isAuthLoading: boolean
    enableDevCreditState?: boolean
}

export function usePrototypeCredits({
    userId,
    isAuthLoading,
    enableDevCreditState = false
}: UsePrototypeCreditsOptions) {
    const summaryCacheKey = userId
        ? `hosted-usage-summary:v2:${userId}`
        : "hosted-usage-summary:v2:guest"
    const prototypeCreditPlanSummary = useCreditAccess((state) => state.summary)
    const isCreditAccessLoading = useCreditAccess((state) => state.isLoading)

    const cachedSummary = useMemo(
        () => readCachedPrototypeCreditValue<PrototypeCreditSummary>(summaryCacheKey),
        [summaryCacheKey]
    )

    const [isUpdatingDevCreditState, setIsUpdatingDevCreditState] = useState(false)
    const [isRefreshingPlan, setIsRefreshingPlan] = useState(false)
    const [devCreditState, setDevCreditState] = useState<PrototypeCreditDevState | null>(null)
    const [hydratedSummary, setHydratedSummary] = useState<PrototypeCreditSummary | null>(
        cachedSummary?.value ?? null
    )

    const usageSummary = useDiskCachedQuery(
        api.credits.getMyCreditUsageSummary,
        {
            key: userId ? `hosted-usage:v2:${userId}` : "hosted-usage:v2:guest",
            default: null
        },
        userId && !isAuthLoading ? {} : "skip"
    )

    const resolvedUsageSummary =
        usageSummary && typeof usageSummary === "object" && "error" in usageSummary
            ? null
            : (usageSummary as PrototypeCreditUsageSummary | null)

    const computedSummary = useMemo(() => {
        if (!prototypeCreditPlanSummary || !resolvedUsageSummary) {
            return null
        }

        return buildPrototypeCreditSummary(prototypeCreditPlanSummary, resolvedUsageSummary)
    }, [prototypeCreditPlanSummary, resolvedUsageSummary])

    useEffect(() => {
        if (!computedSummary) {
            return
        }

        setHydratedSummary(computedSummary)
        writeCachedPrototypeCreditValue(summaryCacheKey, computedSummary)
    }, [computedSummary, summaryCacheKey])

    useEffect(() => {
        setHydratedSummary(cachedSummary?.value ?? null)
    }, [cachedSummary])

    useEffect(() => {
        if (!userId) {
            setHydratedSummary(null)
        }
    }, [userId])

    const refreshDevCreditState = useCallback(async () => {
        if (!userId || isAuthLoading || !enableDevCreditState || !import.meta.env.DEV) {
            setDevCreditState(null)
            return
        }

        try {
            const response = await fetch("/api/dev/credit-state", {
                cache: "no-store"
            })
            if (!response.ok) {
                return
            }
            setDevCreditState((await response.json()) as PrototypeCreditDevState)
        } catch (error) {
            console.error("Failed to load dev credit state:", error)
        }
    }, [enableDevCreditState, isAuthLoading, userId])

    useEffect(() => {
        void refreshDevCreditState()
    }, [refreshDevCreditState])

    const handleSetDevCreditState = useCallback(
        async (payload: PrototypeCreditDevStatePayload) => {
            if (!userId || isUpdatingDevCreditState || !enableDevCreditState) {
                return
            }

            try {
                setIsUpdatingDevCreditState(true)
                const response = await fetch("/api/dev/credit-state", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                })

                if (!response.ok) {
                    throw new Error(`Failed to update dev credit state (${response.status})`)
                }

                const state = (await response.json()) as PrototypeCreditDevState
                setDevCreditState(state)
                await refreshDevCreditState()
            } catch (error) {
                console.error("Failed to update dev credit state:", error)
                toast.error("Failed to update dev credit state")
            } finally {
                setIsUpdatingDevCreditState(false)
            }
        },
        [enableDevCreditState, isUpdatingDevCreditState, refreshDevCreditState, userId]
    )

    const refreshCredits = useCallback(async () => {
        if (!userId || isAuthLoading) {
            return
        }

        const refreshStartedAt = Date.now()
        try {
            setIsRefreshingPlan(true)
            await refreshDevCreditState()
        } finally {
            const elapsed = Date.now() - refreshStartedAt
            if (elapsed < MIN_REFRESH_VISIBLE_MS) {
                await new Promise((resolve) =>
                    window.setTimeout(resolve, MIN_REFRESH_VISIBLE_MS - elapsed)
                )
            }
            setIsRefreshingPlan(false)
        }
    }, [isAuthLoading, refreshDevCreditState, userId])

    return {
        summary: computedSummary ?? hydratedSummary,
        isLoading:
            isCreditAccessLoading || (!computedSummary && !hydratedSummary && Boolean(userId)),
        isRefreshing: isRefreshingPlan,
        refreshCredits,
        devCreditState,
        isUpdatingDevCreditState,
        setDevCreditState: handleSetDevCreditState
    }
}
