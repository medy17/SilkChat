import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger
} from "@/components/ui/responsive-popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { buildLemonSqueezyCheckoutUrl } from "@/lib/billing"
import { optionalBrowserEnv } from "@/lib/browser-env"
import type {
    PrototypeCreditDevState,
    PrototypeCreditDevStatePayload,
    PrototypeCreditSummary
} from "@/lib/prototype-credits"
import { cn } from "@/lib/utils"
import { useConvexQuery } from "@convex-dev/react-query"
import { Clock, Crown, RefreshCw, Shield, Wallet } from "lucide-react"
import { memo, type ReactNode, useEffect, useMemo, useState } from "react"

const formatUsageCountdown = (target: number | null, now: number) => {
    if (!target) return "Ready"
    const remainingMinutes = Math.max(0, Math.ceil((target - now) / (60 * 1000)))
    if (remainingMinutes <= 0) return "Now"

    const days = Math.floor(remainingMinutes / (24 * 60))
    const hours = Math.floor((remainingMinutes % (24 * 60)) / 60)
    const minutes = remainingMinutes % 60
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

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
            Usage will appear here once your account data is available.
        </div>
    )
}

function PrototypeCreditsBody({
    summary,
    devCreditState,
    shouldShowDevCreditPlanToggle,
    isUpdatingDevCreditState,
    onSetDevCreditState,
    onRefresh,
    isRefreshing,
    planState,
    showPlanHeader = true,
    className
}: {
    summary: PrototypeCreditSummary | null
    devCreditState: PrototypeCreditDevState | null
    shouldShowDevCreditPlanToggle: boolean
    isUpdatingDevCreditState: boolean
    onSetDevCreditState: (payload: PrototypeCreditDevStatePayload) => Promise<void>
    onRefresh: () => Promise<void>
    isRefreshing: boolean
    planState?: string[]
    showPlanHeader?: boolean
    className?: string
}) {
    const session = useSession()
    const checkoutUser = session.user
    const checkoutBillingSummary = useConvexQuery(
        api.billing.getMyBillingSummary,
        summary?.plan === "free" && checkoutUser?.id ? {} : "skip"
    )
    const checkoutUrl = optionalBrowserEnv("VITE_LEMONSQUEEZY_PRO_CHECKOUT_URL")
    const checkoutBillingUserId =
        checkoutBillingSummary && !("error" in checkoutBillingSummary)
            ? checkoutBillingSummary.userId
            : null
    const checkoutEmail = checkoutUser?.email
    const checkoutName = checkoutUser?.name
    const proCheckoutUrl = useMemo(() => {
        if (!checkoutUrl || !checkoutBillingUserId) return null

        return buildLemonSqueezyCheckoutUrl({
            checkoutUrl,
            userId: checkoutBillingUserId,
            email: checkoutEmail,
            name: checkoutName
        })
    }, [checkoutBillingUserId, checkoutEmail, checkoutName, checkoutUrl])
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
    const [clockNow, setClockNow] = useState(() => Date.now())

    useEffect(() => {
        const interval = window.setInterval(() => setClockNow(Date.now()), 30 * 1000)
        return () => window.clearInterval(interval)
    }, [])

    const fiveHourRecoversAt = summary?.usageMetering?.fiveHour.recoversAt ?? null
    useEffect(() => {
        if (!fiveHourRecoversAt) return
        const delay = fiveHourRecoversAt - Date.now()
        if (delay <= 0) return
        const timeout = window.setTimeout(() => void onRefresh(), delay + 1000)
        return () => window.clearTimeout(timeout)
    }, [fiveHourRecoversAt, onRefresh])

    if (!summary) {
        return <PrototypeCreditsEmptyState />
    }

    const PlanIcon = summary.plan === "pro" ? Crown : Wallet
    const shouldAnimateRefresh = isRefreshing || isRefreshAnimating
    const usageMetering = summary.usageMetering

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
            {showPlanHeader ? (
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5 md:space-y-1">
                        <div className="flex items-center gap-2">
                            <PlanIcon className="h-4 w-4 shrink-0" />
                            <span className="font-medium text-sm">
                                {summary.plan === "pro" ? "Pro Plan" : "Free Plan"}
                            </span>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-[var(--radius-md)]"
                        onClick={() => void handleRefresh()}
                        disabled={shouldAnimateRefresh}
                        title="Refresh usage"
                    >
                        <RefreshCw
                            className={cn(
                                "h-4 w-4",
                                shouldAnimateRefresh && "animate-spin [animation-duration:800ms]"
                            )}
                        />
                        <span className="sr-only">Refresh usage</span>
                    </Button>
                </div>
            ) : null}

            <div className="space-y-2.5 md:space-y-3">
                {(
                    [
                        ["Base", usageMetering.fiveHour, usageMetering.fiveHour.recoversAt],
                        ["Monthly", usageMetering.monthly, summary.periodEndsAt]
                    ] as const
                ).map(([label, window, resetsAt]) => {
                    const remainingPercent =
                        window.limitUsd > 0 ? (window.remainingUsd / window.limitUsd) * 100 : 0
                    return (
                        <div key={label} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{label}</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            aria-label={`${Math.max(0, Math.min(100, Math.round(remainingPercent)))}% remaining`}
                                        >
                                            <Clock className="size-3" />
                                            <span>{formatUsageCountdown(resetsAt, clockNow)}</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {Math.max(0, Math.min(100, Math.round(remainingPercent)))}%
                                        remaining
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Progress value={remainingPercent} className="h-2" />
                        </div>
                    )
                })}
            </div>
            {/*
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground sm:text-xs">
                <span>{summary.requestCounts.internal} internal</span>
                <span className="inline-flex items-center gap-1">
                    <KeyRound className="h-3 w-3" />
                    {summary.requestCounts.byok} BYOK
                </span>
            </div>
            */}
            {planState?.length || periodLabel ? (
                <div className="space-y-1 text-muted-foreground text-xs">
                    {planState?.map((row) => (
                        <div key={row}>{row}</div>
                    ))}
                    {periodLabel && !planState?.length ? <div>Resets on {periodLabel}</div> : null}
                </div>
            ) : null}

            {summary.plan === "free" ? (
                <Button
                    asChild={Boolean(proCheckoutUrl)}
                    disabled={!proCheckoutUrl}
                    size="sm"
                    className="w-full"
                >
                    {proCheckoutUrl ? (
                        <a href={proCheckoutUrl}>
                            <Crown className="size-4" />
                            Upgrade to Pro
                        </a>
                    ) : (
                        <span className="inline-flex items-center gap-1.5">
                            <Crown className="size-4" />
                            Upgrade to Pro
                        </span>
                    )}
                </Button>
            ) : null}

            {shouldShowDevCreditPlanToggle && (
                <PrototypeCreditDevLab
                    summary={summary}
                    devCreditState={devCreditState}
                    disabled={isUpdatingDevCreditState}
                    onSetDevCreditState={onSetDevCreditState}
                />
            )}
        </div>
    )
}

const hostedUsagePresetActions: Array<{
    label: string
    payload: PrototypeCreditDevStatePayload
}> = [
    { label: "Reset 5h", payload: { usageScenario: "usage_5h_reset" } },
    { label: "5h near", payload: { usageScenario: "usage_5h_near_limit" } },
    { label: "5h 0", payload: { usageScenario: "usage_5h_exhausted" } },
    { label: "5h expired", payload: { usageScenario: "usage_5h_expired" } },
    { label: "Month near", payload: { usageScenario: "usage_monthly_near_limit" } },
    { label: "Month 0", payload: { usageScenario: "usage_monthly_exhausted" } }
]

const periodPresetActions: Array<{
    label: string
    payload: PrototypeCreditDevStatePayload
}> = [
    { label: "Default", payload: { periodAnchorPreset: "default" } },
    { label: "Ends today", payload: { periodAnchorPreset: "ending_today" } },
    { label: "Ends tomorrow", payload: { periodAnchorPreset: "ending_tomorrow" } }
]

function PrototypeCreditDevLab({
    summary,
    devCreditState,
    disabled,
    onSetDevCreditState
}: {
    summary: PrototypeCreditSummary
    devCreditState: PrototypeCreditDevState | null
    disabled: boolean
    onSetDevCreditState: (payload: PrototypeCreditDevStatePayload) => Promise<void>
}) {
    const isStaff = devCreditState?.access.isStaff ?? false
    const bypassLimits = devCreditState?.access.bypassLimits ?? false
    const bypassToolCallLimits = devCreditState?.access.bypassToolCallLimits ?? false

    return (
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-dashed p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
                <Shield className="size-3.5" />
                Dev
            </div>

            <PrototypeCreditPlanToggle
                plan={summary.plan}
                disabled={disabled}
                onSetCreditPlan={(plan) => onSetDevCreditState({ plan })}
            />

            <div className="grid grid-cols-2 gap-2">
                {hostedUsagePresetActions.map((action) => (
                    <Button
                        key={action.label}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 rounded-[var(--radius-md)] text-xs"
                        disabled={disabled}
                        onClick={() => void onSetDevCreditState(action.payload)}
                    >
                        {action.label}
                    </Button>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
                {periodPresetActions.map((action) => (
                    <Button
                        key={action.label}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-[var(--radius-md)] px-2 text-xs"
                        disabled={disabled}
                        onClick={() => void onSetDevCreditState(action.payload)}
                    >
                        {action.label}
                    </Button>
                ))}
            </div>

            <div className="space-y-2">
                <DevAccessSwitch
                    label="Staff"
                    checked={isStaff}
                    disabled={disabled}
                    onCheckedChange={(checked) => onSetDevCreditState({ isStaff: checked })}
                />
                <DevAccessSwitch
                    label="Bypass usage limits"
                    checked={bypassLimits}
                    disabled={disabled}
                    onCheckedChange={(checked) => onSetDevCreditState({ bypassLimits: checked })}
                />
                <DevAccessSwitch
                    label="Bypass tool call limit"
                    checked={bypassToolCallLimits}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                        onSetDevCreditState({ bypassToolCallLimits: checked })
                    }
                />
            </div>

            {devCreditState?.warnings?.map((warning) => (
                <p key={warning} className="text-amber-600 text-xs dark:text-amber-400">
                    {warning}
                </p>
            ))}
        </div>
    )
}

function DevAccessSwitch({
    label,
    checked,
    disabled,
    onCheckedChange
}: {
    label: string
    checked: boolean
    disabled: boolean
    onCheckedChange: (checked: boolean) => Promise<void>
}) {
    return (
        <div className="flex items-center justify-between gap-3 text-xs">
            <span>{label}</span>
            <Switch
                checked={checked}
                disabled={disabled}
                onCheckedChange={(checkedValue) => void onCheckedChange(checkedValue)}
            />
        </div>
    )
}

export const PrototypeCreditsQuickView = memo(function PrototypeCreditsQuickView({
    summary,
    isLoading,
    isRefreshing,
    shouldShowDevCreditPlanToggle,
    devCreditState,
    isUpdatingDevCreditState,
    onSetDevCreditState,
    onRefresh
}: {
    summary: PrototypeCreditSummary | null
    isLoading: boolean
    isRefreshing: boolean
    shouldShowDevCreditPlanToggle: boolean
    devCreditState: PrototypeCreditDevState | null
    isUpdatingDevCreditState: boolean
    onSetDevCreditState: (payload: PrototypeCreditDevStatePayload) => Promise<void>
    onRefresh: () => Promise<void>
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
                    title="Usage"
                >
                    <Wallet className="h-4 w-4" />
                    <span className="sr-only">Usage</span>
                </Button>
            </ResponsivePopoverTrigger>
            <ResponsivePopoverContent
                side="bottom"
                align="end"
                title="Usage"
                className="w-full max-w-none overflow-hidden p-0 md:w-[22rem] md:p-4"
            >
                {isLoading ? (
                    <PrototypeCreditsLoadingState className="px-4 pt-5 pb-4 md:p-0" />
                ) : (
                    <PrototypeCreditsBody
                        summary={summary}
                        devCreditState={devCreditState}
                        shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
                        isUpdatingDevCreditState={isUpdatingDevCreditState}
                        onSetDevCreditState={onSetDevCreditState}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
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
    devCreditState,
    isUpdatingDevCreditState,
    onSetDevCreditState,
    onRefresh,
    planState,
    title = "Included usage",
    headerAction,
    showPlanHeader = true,
    className
}: {
    summary: PrototypeCreditSummary | null
    isLoading: boolean
    isRefreshing: boolean
    shouldShowDevCreditPlanToggle: boolean
    devCreditState: PrototypeCreditDevState | null
    isUpdatingDevCreditState: boolean
    onSetDevCreditState: (payload: PrototypeCreditDevStatePayload) => Promise<void>
    onRefresh: () => Promise<void>
    planState?: string[]
    title?: ReactNode
    headerAction?: ReactNode
    showPlanHeader?: boolean
    className?: string
}) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className={headerAction ? "self-center" : undefined}>{title}</CardTitle>
                {/* <CardDescription>Track your five-hour and monthly included usage.</CardDescription> */}
                {headerAction ? (
                    <CardAction className="row-span-1 row-start-1 self-center">
                        {headerAction}
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <PrototypeCreditsLoadingState />
                ) : (
                    <PrototypeCreditsBody
                        summary={summary}
                        devCreditState={devCreditState}
                        shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
                        isUpdatingDevCreditState={isUpdatingDevCreditState}
                        onSetDevCreditState={onSetDevCreditState}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
                        planState={planState}
                        showPlanHeader={showPlanHeader}
                    />
                )}
            </CardContent>
        </Card>
    )
})
