import { api } from "@/convex/_generated/api"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import {
    type PrototypeCreditDevState,
    type PrototypeCreditDevStatePayload,
    type PrototypeCreditPlanSummary,
    type PrototypeCreditSummary,
    type PrototypeCreditUsageSummary,
    buildPrototypeCreditSummary,
    isPrototypeCreditCacheStale,
    readCachedPrototypeCreditValue,
    writeCachedPrototypeCreditValue
} from "@/lib/prototype-credits"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

const PLAN_CACHE_MAX_AGE_MS = 5 * 60 * 1000
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
    const planCacheKey = userId ? `hosted-usage-plan:v2:${userId}` : "hosted-usage-plan:v2:guest"

    const cachedSummary = useMemo(
        () => readCachedPrototypeCreditValue<PrototypeCreditSummary>(summaryCacheKey),
        [summaryCacheKey]
    )
    const cachedPlan = useMemo(
        () => readCachedPrototypeCreditValue<PrototypeCreditPlanSummary>(planCacheKey),
        [planCacheKey]
    )

    const [isUpdatingCreditPlan, setIsUpdatingCreditPlan] = useState(false)
    const [isUpdatingDevCreditState, setIsUpdatingDevCreditState] = useState(false)
    const [isRefreshingPlan, setIsRefreshingPlan] = useState(false)
    const [devCreditState, setDevCreditState] = useState<PrototypeCreditDevState | null>(null)
    const [prototypeCreditPlanSummary, setPrototypeCreditPlanSummary] =
        useState<PrototypeCreditPlanSummary | null>(cachedPlan?.value ?? null)
    const [lastPlanFetchAt, setLastPlanFetchAt] = useState(cachedPlan?.savedAt ?? 0)
    const [hydratedSummary, setHydratedSummary] = useState<PrototypeCreditSummary | null>(
        cachedSummary?.value ?? null
    )
    const inFlightPlanRefreshRef = useRef<Promise<void> | null>(null)

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
        setPrototypeCreditPlanSummary(cachedPlan?.value ?? null)
        setLastPlanFetchAt(cachedPlan?.savedAt ?? 0)
    }, [cachedPlan])

    useEffect(() => {
        setHydratedSummary(cachedSummary?.value ?? null)
    }, [cachedSummary])

    useEffect(() => {
        if (!userId) {
            setPrototypeCreditPlanSummary(null)
            setHydratedSummary(null)
            setLastPlanFetchAt(0)
        }
    }, [userId])

    const refreshPlanSummary = useCallback(
        async ({ force = false }: { force?: boolean } = {}) => {
            if (!userId || isAuthLoading) {
                return
            }

            if (
                !force &&
                prototypeCreditPlanSummary &&
                !isPrototypeCreditCacheStale(lastPlanFetchAt, PLAN_CACHE_MAX_AGE_MS)
            ) {
                return
            }

            if (inFlightPlanRefreshRef.current) {
                return inFlightPlanRefreshRef.current
            }

            const request = (async () => {
                const refreshStartedAt = Date.now()
                try {
                    setIsRefreshingPlan(true)
                    const response = await fetch("/api/credit-summary", {
                        cache: "no-store"
                    })
                    if (!response.ok) {
                        throw new Error(`Failed to load credit summary (${response.status})`)
                    }

                    const summary = (await response.json()) as PrototypeCreditPlanSummary
                    setPrototypeCreditPlanSummary(summary)
                    setLastPlanFetchAt(Date.now())
                    writeCachedPrototypeCreditValue(planCacheKey, summary)
                } catch (error) {
                    console.error("Failed to load prototype credit summary:", error)
                } finally {
                    const elapsed = Date.now() - refreshStartedAt
                    if (elapsed < MIN_REFRESH_VISIBLE_MS) {
                        await new Promise((resolve) =>
                            window.setTimeout(resolve, MIN_REFRESH_VISIBLE_MS - elapsed)
                        )
                    }
                    setIsRefreshingPlan(false)
                    inFlightPlanRefreshRef.current = null
                }
            })()

            inFlightPlanRefreshRef.current = request
            return request
        },
        [isAuthLoading, lastPlanFetchAt, planCacheKey, prototypeCreditPlanSummary, userId]
    )

    useEffect(() => {
        void refreshPlanSummary()
    }, [refreshPlanSummary])

    useEffect(() => {
        if (!userId || isAuthLoading) {
            return
        }

        const handleFocus = () => {
            void refreshPlanSummary()
        }

        window.addEventListener("focus", handleFocus)
        return () => window.removeEventListener("focus", handleFocus)
    }, [isAuthLoading, refreshPlanSummary, userId])

    const handleSetCreditPlan = useCallback(
        async (plan: "free" | "pro") => {
            if (!userId || isUpdatingCreditPlan) {
                return
            }

            try {
                setIsUpdatingCreditPlan(true)
                const response = await fetch("/api/dev/credit-plan", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        plan
                    })
                })

                if (!response.ok) {
                    throw new Error(`Failed to update plan (${response.status})`)
                }

                await refreshPlanSummary({ force: true })
            } catch (error) {
                console.error("Failed to update prototype credit plan:", error)
                toast.error("Failed to update credit plan")
            } finally {
                setIsUpdatingCreditPlan(false)
            }
        },
        [isUpdatingCreditPlan, refreshPlanSummary, userId]
    )

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
                await refreshPlanSummary({ force: true })
                await refreshDevCreditState()
            } catch (error) {
                console.error("Failed to update dev credit state:", error)
                toast.error("Failed to update dev credit state")
            } finally {
                setIsUpdatingDevCreditState(false)
            }
        },
        [
            enableDevCreditState,
            isUpdatingDevCreditState,
            refreshDevCreditState,
            refreshPlanSummary,
            userId
        ]
    )

    return {
        summary: computedSummary ?? hydratedSummary,
        isLoading: !computedSummary && !hydratedSummary && Boolean(userId),
        isRefreshing: isRefreshingPlan,
        isUpdatingCreditPlan,
        refreshCredits: async () => {
            await refreshPlanSummary({ force: true })
            await refreshDevCreditState()
        },
        setCreditPlan: handleSetCreditPlan,
        devCreditState,
        isUpdatingDevCreditState,
        setDevCreditState: handleSetDevCreditState
    }
}
