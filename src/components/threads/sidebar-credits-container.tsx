import { api } from "@/convex/_generated/api"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { memo, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { type PrototypeCreditSummary, PrototypeCreditsSection } from "./sidebar-credits"

type PrototypeCreditPlanSummary = {
    enabled: boolean
    plan: "free" | "pro"
    basic: {
        limit: number
    }
    pro: {
        limit: number
    }
}

interface SidebarCreditsContainerProps {
    userId: string | undefined
    isAuthLoading: boolean
    shouldShowPrototypeCredits: boolean
    shouldShowDevCreditPlanToggle: boolean
}

export const SidebarCreditsContainer = memo(function SidebarCreditsContainer({
    userId,
    isAuthLoading,
    shouldShowPrototypeCredits,
    shouldShowDevCreditPlanToggle
}: SidebarCreditsContainerProps) {
    const [isUpdatingCreditPlan, setIsUpdatingCreditPlan] = useState(false)
    const [creditPlanRefreshNonce, setCreditPlanRefreshNonce] = useState(0)
    const [prototypeCreditPlanSummary, setPrototypeCreditPlanSummary] =
        useState<PrototypeCreditPlanSummary | null>(null)

    const usageSummary = useDiskCachedQuery(
        api.credits.getMyCreditUsageSummary,
        {
            key: userId ? `prototype-credit-usage:${userId}` : "prototype-credit-usage:guest",
            default: null
        },
        userId && !isAuthLoading ? {} : "skip"
    )

    const resolvedUsageSummary =
        usageSummary && typeof usageSummary === "object" && "error" in usageSummary
            ? null
            : usageSummary

    const prototypeCreditSummary = useMemo<PrototypeCreditSummary | null>(() => {
        if (!prototypeCreditPlanSummary || !resolvedUsageSummary) {
            return null
        }

        return {
            enabled: prototypeCreditPlanSummary.enabled,
            plan: prototypeCreditPlanSummary.plan,
            periodKey: resolvedUsageSummary.periodKey,
            periodStartsAt: resolvedUsageSummary.periodStartsAt,
            periodEndsAt: resolvedUsageSummary.periodEndsAt,
            basic: {
                limit: prototypeCreditPlanSummary.basic.limit,
                used: resolvedUsageSummary.basic.used,
                remaining: Math.max(
                    0,
                    prototypeCreditPlanSummary.basic.limit - resolvedUsageSummary.basic.used
                )
            },
            pro: {
                limit: prototypeCreditPlanSummary.pro.limit,
                used: resolvedUsageSummary.pro.used,
                remaining: Math.max(
                    0,
                    prototypeCreditPlanSummary.pro.limit - resolvedUsageSummary.pro.used
                )
            },
            requestCounts: resolvedUsageSummary.requestCounts
        }
    }, [prototypeCreditPlanSummary, resolvedUsageSummary])

    useEffect(() => {
        if (!userId) {
            setPrototypeCreditPlanSummary(null)
            return
        }

        if (isAuthLoading) {
            return
        }

        let cancelled = false
        const refreshPlanSummary = async () => {
            try {
                const response = await fetch(
                    `/api/credit-summary?refresh=${creditPlanRefreshNonce}`
                )
                if (!response.ok) {
                    throw new Error(`Failed to load credit summary (${response.status})`)
                }
                const summary = (await response.json()) as PrototypeCreditPlanSummary
                if (!cancelled) {
                    setPrototypeCreditPlanSummary(summary)
                }
            } catch (error) {
                console.error("Failed to load prototype credit summary:", error)
            }
        }

        void refreshPlanSummary()
        const interval = window.setInterval(() => {
            void refreshPlanSummary()
        }, 15000)

        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [isAuthLoading, creditPlanRefreshNonce, userId])

    const handleSetCreditPlan = async (plan: "free" | "pro") => {
        if (!userId || isUpdatingCreditPlan) return

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

            setCreditPlanRefreshNonce((previous) => previous + 1)
        } catch (error) {
            console.error("Failed to update prototype credit plan:", error)
            toast.error("Failed to update credit plan")
        } finally {
            setIsUpdatingCreditPlan(false)
        }
    }

    return (
        <PrototypeCreditsSection
            shouldShow={shouldShowPrototypeCredits}
            summary={prototypeCreditSummary}
            shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
            isUpdatingCreditPlan={isUpdatingCreditPlan}
            onSetCreditPlan={handleSetCreditPlan}
        />
    )
})
