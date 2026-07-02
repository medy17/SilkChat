import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger
} from "@/components/ui/responsive-popover"
import { Skeleton } from "@/components/ui/skeleton"
import type { PrototypeCreditSummary } from "@/lib/prototype-credits"
import { cn } from "@/lib/utils"
import { Crown, KeyRound, RefreshCw, Wallet } from "lucide-react"
import { memo, useMemo, useState } from "react"

function PrototypeCreditPlanToggle({
    plan,
    disabled,
    onSetCreditPlan
}: {
    plan: PrototypeCreditSummary["plan"]
    disabled: boolean
    onSetCreditPlan: (plan: "free" | "pro") => Promise<void>
}) {
    return (
        <div className="flex gap-2">
            <Button
                size="sm"
                variant={plan === "free" ? "default" : "outline"}
                className="h-8 flex-1"
                disabled={disabled}
                onClick={() => void onSetCreditPlan("free")}
            >
                Free
            </Button>
            <Button
                size="sm"
                variant={plan === "pro" ? "default" : "outline"}
                className="h-8 flex-1"
                disabled={disabled}
                onClick={() => void onSetCreditPlan("pro")}
            >
                Pro
            </Button>
        </div>
    )
}

function PrototypeCreditsLoadingState({ className }: { className?: string }) {
    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 shrink-0" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-8" />
            </div>

            <div className="space-y-3">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                </div>
            </div>

            <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
    )
}

function PrototypeCreditsEmptyState() {
    return (
        <div className="rounded-[var(--radius-lg)] border border-dashed p-4 text-muted-foreground text-sm">
            Credits will appear here once your account data is available.
        </div>
    )
}

function PrototypeCreditsBody({
    summary,
    shouldShowDevCreditPlanToggle,
    isUpdatingCreditPlan,
    onSetCreditPlan,
    onRefresh,
    isRefreshing,
    upgradeUrl,
    className
}: {
    summary: PrototypeCreditSummary | null
    shouldShowDevCreditPlanToggle: boolean
    isUpdatingCreditPlan: boolean
    onSetCreditPlan: (plan: "free" | "pro") => Promise<void>
    onRefresh: () => Promise<void>
    isRefreshing: boolean
    upgradeUrl?: string | null
    className?: string
}) {
    const periodLabel = useMemo(() => {
        if (!summary) {
            return null
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(new Date(summary.periodEndsAt))
    }, [summary])
    const [isRefreshAnimating, setIsRefreshAnimating] = useState(false)

    if (!summary) {
        return <PrototypeCreditsEmptyState />
    }

    const basicProgress =
        summary.basic.limit > 0 ? (summary.basic.used / summary.basic.limit) * 100 : 0
    const proProgress = summary.pro.limit > 0 ? (summary.pro.used / summary.pro.limit) * 100 : 0
    const PlanIcon = summary.plan === "pro" ? Crown : Wallet
    const shouldAnimateRefresh = isRefreshing || isRefreshAnimating
    const shouldShowProUpsell = summary.plan === "free"

    const handleRefresh = async () => {
        if (shouldAnimateRefresh) {
            return
        }

        try {
            setIsRefreshAnimating(true)
            await onRefresh()
        } finally {
            setIsRefreshAnimating(false)
        }
    }

    return (
        <div className={cn("space-y-3 md:space-y-4", className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 md:space-y-1">
                    <div className="flex items-center gap-2">
                        <PlanIcon className="h-4 w-4 shrink-0" />
                        <span className="font-medium text-sm">
                            {summary.plan === "pro" ? "Pro Plan" : "Free Plan"}
                        </span>
                    </div>
                    {periodLabel ? (
                        <div className="text-muted-foreground text-xs">Resets on {periodLabel}</div>
                    ) : null}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-[var(--radius-md)]"
                    onClick={() => void handleRefresh()}
                    disabled={shouldAnimateRefresh}
                    title="Refresh credits"
                >
                    <RefreshCw
                        className={cn(
                            "h-4 w-4",
                            shouldAnimateRefresh && "animate-spin [animation-duration:800ms]"
                        )}
                    />
                    <span className="sr-only">Refresh credits</span>
                </Button>
            </div>

            <div className="space-y-2.5 md:space-y-3">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Basic</span>
                        <span>
                            {summary.basic.used}/{summary.basic.limit}
                        </span>
                    </div>
                    <Progress value={basicProgress} className="h-2" />
                    <div className="text-[11px] text-muted-foreground sm:text-xs">
                        {summary.basic.remaining} remaining
                    </div>
                </div>
                {shouldShowProUpsell ? (
                    <div className="rounded-[var(--radius-lg)] border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-xs">
                                    <Crown className="size-3.5 shrink-0" />
                                    <span>Pro credits</span>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Upgrade for image generation and premium models.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="h-8 shrink-0 rounded-[var(--radius-md)]"
                                asChild={Boolean(upgradeUrl)}
                                disabled={!upgradeUrl}
                            >
                                {upgradeUrl ? (
                                    <a href={upgradeUrl}>Upgrade</a>
                                ) : (
                                    <span>Upgrade</span>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Pro</span>
                            <span>
                                {summary.pro.used}/{summary.pro.limit}
                            </span>
                        </div>
                        <Progress value={proProgress} className="h-2" />
                        <div className="text-[11px] text-muted-foreground sm:text-xs">
                            {summary.pro.remaining} remaining
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground sm:text-xs">
                <span>{summary.requestCounts.internal} internal</span>
                <span className="inline-flex items-center gap-1">
                    <KeyRound className="h-3 w-3" />
                    {summary.requestCounts.byok} BYOK
                </span>
            </div>

            {shouldShowDevCreditPlanToggle && (
                <PrototypeCreditPlanToggle
                    plan={summary.plan}
                    disabled={isUpdatingCreditPlan}
                    onSetCreditPlan={onSetCreditPlan}
                />
            )}
        </div>
    )
}

export const PrototypeCreditsQuickView = memo(function PrototypeCreditsQuickView({
    summary,
    isLoading,
    isRefreshing,
    shouldShowDevCreditPlanToggle,
    isUpdatingCreditPlan,
    onSetCreditPlan,
    onRefresh,
    upgradeUrl
}: {
    summary: PrototypeCreditSummary | null
    isLoading: boolean
    isRefreshing: boolean
    shouldShowDevCreditPlanToggle: boolean
    isUpdatingCreditPlan: boolean
    onSetCreditPlan: (plan: "free" | "pro") => Promise<void>
    onRefresh: () => Promise<void>
    upgradeUrl?: string | null
}) {
    return (
        <ResponsivePopover
            modal={false}
            onOpenChange={(open) => {
                if (open) {
                    void onRefresh()
                }
            }}
        >
            <ResponsivePopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-[var(--radius-md)]"
                    title="Credits"
                >
                    <Wallet className="h-4 w-4" />
                    <span className="sr-only">Credits</span>
                </Button>
            </ResponsivePopoverTrigger>
            <ResponsivePopoverContent
                side="bottom"
                align="end"
                title="Credits"
                className="w-full max-w-none overflow-hidden p-0 md:w-[22rem] md:p-4"
            >
                {isLoading ? (
                    <PrototypeCreditsLoadingState className="px-4 pt-5 pb-4 md:p-0" />
                ) : (
                    <PrototypeCreditsBody
                        summary={summary}
                        shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
                        isUpdatingCreditPlan={isUpdatingCreditPlan}
                        onSetCreditPlan={onSetCreditPlan}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
                        upgradeUrl={upgradeUrl}
                        className="px-4 pt-5 pb-4 md:p-0"
                    />
                )}
            </ResponsivePopoverContent>
        </ResponsivePopover>
    )
})

export const PrototypeCreditsCard = memo(function PrototypeCreditsCard({
    summary,
    isLoading,
    isRefreshing,
    shouldShowDevCreditPlanToggle,
    isUpdatingCreditPlan,
    onSetCreditPlan,
    onRefresh,
    upgradeUrl,
    className
}: {
    summary: PrototypeCreditSummary | null
    isLoading: boolean
    isRefreshing: boolean
    shouldShowDevCreditPlanToggle: boolean
    isUpdatingCreditPlan: boolean
    onSetCreditPlan: (plan: "free" | "pro") => Promise<void>
    onRefresh: () => Promise<void>
    upgradeUrl?: string | null
    className?: string
}) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Credits</CardTitle>
                <CardDescription>Track plan limits and request usage.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <PrototypeCreditsLoadingState />
                ) : (
                    <PrototypeCreditsBody
                        summary={summary}
                        shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
                        isUpdatingCreditPlan={isUpdatingCreditPlan}
                        onSetCreditPlan={onSetCreditPlan}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
                        upgradeUrl={upgradeUrl}
                    />
                )}
            </CardContent>
        </Card>
    )
})
