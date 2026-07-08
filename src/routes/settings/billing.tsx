import { PrototypeCreditsCard } from "@/components/credits/prototype-credits"
import { pricingOptions } from "@/components/landing-page/content"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { usePrototypeCredits } from "@/hooks/use-prototype-credits"
import { buildLemonSqueezyCheckoutUrl } from "@/lib/billing"
import { optionalBrowserEnv } from "@/lib/browser-env"
import { cn } from "@/lib/utils"
import { useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Check, Crown, ExternalLink, Wallet } from "lucide-react"
import { useMemo } from "react"

export const Route = createFileRoute("/settings/billing")({
    component: BillingSettingsRoute
})

const formatDate = (value?: string) => {
    if (!value) return null

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(value))
}

const getSubscriptionTimelineRows = ({
    plan,
    status,
    renewsAt,
    endsAt,
    trialEndsAt
}: {
    plan: "free" | "pro"
    status?: string
    renewsAt: string | null
    endsAt: string | null
    trialEndsAt: string | null
}) => {
    if (!status) {
        return [{ label: "Subscription:", value: plan === "pro" ? "Active" : "None" }]
    }

    if (status === "expired") {
        return [{ label: "Expired at:", value: endsAt ?? renewsAt ?? "Ended" }]
    }

    if (status === "cancelled") {
        return [{ label: "Expires on:", value: endsAt ?? renewsAt ?? "Not scheduled" }]
    }

    if (status === "past_due" || status === "unpaid") {
        return [{ label: "Payment failed:", value: renewsAt ?? "Review billing" }]
    }

    if (status === "paused") {
        return [{ label: "Paused until:", value: renewsAt ?? "Paused" }]
    }

    const rows = [{ label: "Renews at:", value: renewsAt ?? "Not scheduled" }]

    if (trialEndsAt) {
        rows.push({ label: "Trial ends at:", value: trialEndsAt })
    }

    return rows
}

function BillingSettingsRoute() {
    const session = useSession()
    const user = session.user
    const billingSummary = useConvexQuery(api.billing.getMyBillingSummary, user?.id ? {} : "skip")
    const {
        summary: creditSummary,
        isLoading: isCreditSummaryLoading,
        isRefreshing,
        isUpdatingCreditPlan,
        devCreditState,
        isUpdatingDevCreditState,
        refreshCredits,
        setDevCreditState
    } = usePrototypeCredits({
        userId: user?.id,
        isAuthLoading: session.isPending
    })
    const checkoutUrl = optionalBrowserEnv("VITE_LEMONSQUEEZY_PRO_CHECKOUT_URL")
    const customerPortalUrl = optionalBrowserEnv("VITE_LEMONSQUEEZY_CUSTOMER_PORTAL_URL")
    const billingUserId =
        billingSummary && !("error" in billingSummary) ? billingSummary.userId : null
    const proCheckoutUrl = useMemo(() => {
        if (!checkoutUrl || !billingUserId || !user) {
            return null
        }

        return buildLemonSqueezyCheckoutUrl({
            checkoutUrl,
            userId: billingUserId,
            email: user.email,
            name: user.name
        })
    }, [billingUserId, checkoutUrl, user?.email, user?.name])

    const isLoadingBilling = Boolean(user?.id) && billingSummary === undefined
    const plan = billingSummary && !("error" in billingSummary) ? billingSummary.plan : "free"
    const subscription =
        billingSummary && !("error" in billingSummary) ? billingSummary.subscription : null
    const statusLabel = subscription?.status
        ? subscription.status.replace(/_/g, " ")
        : plan === "pro"
          ? "active"
          : "none"
    const renewsAtLabel = formatDate(subscription?.renewsAt)
    const endsAtLabel = formatDate(subscription?.endsAt)
    const trialEndsAtLabel = formatDate(subscription?.trialEndsAt)
    const subscriptionTimelineRows = getSubscriptionTimelineRows({
        plan,
        status: subscription?.status,
        renewsAt: renewsAtLabel,
        endsAt: endsAtLabel,
        trialEndsAt: trialEndsAtLabel
    })
    const PlanIcon = plan === "pro" ? Crown : Wallet

    return (
        <SettingsLayout
            title="Billing"
            description="Manage your plan, Pro access, and monthly credits."
        >
            <div className="space-y-6">
                <div className="rounded-[var(--radius-xl)] border bg-card p-6 text-card-foreground shadow-sm">
                    {isLoadingBilling ? (
                        <div className="space-y-5">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-10 w-40" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="grid size-10 place-items-center rounded-[var(--radius-lg)] bg-muted">
                                        <PlanIcon className="size-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-xl">
                                            {plan === "pro" ? "Pro Plan" : "Free Plan"}
                                        </h3>
                                        <p className="text-muted-foreground text-sm capitalize">
                                            {statusLabel}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1 text-sm">
                                    {subscriptionTimelineRows.map((row) => (
                                        <div key={row.label} className="flex gap-2">
                                            <span className="text-muted-foreground">
                                                {row.label}
                                            </span>
                                            <span>{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                                {plan === "pro" ? (
                                    <Button
                                        asChild={Boolean(customerPortalUrl)}
                                        disabled={!customerPortalUrl}
                                        className="rounded-[var(--radius-lg)]"
                                    >
                                        {customerPortalUrl ? (
                                            <a
                                                href={customerPortalUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Manage subscription
                                                <ExternalLink className="ml-2 size-4" />
                                            </a>
                                        ) : (
                                            <span>Manage subscription</span>
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        asChild={Boolean(proCheckoutUrl)}
                                        disabled={!proCheckoutUrl}
                                        className="rounded-[var(--radius-lg)]"
                                    >
                                        {proCheckoutUrl ? (
                                            <a href={proCheckoutUrl}>Upgrade to Pro</a>
                                        ) : (
                                            <span>Upgrade to Pro</span>
                                        )}
                                    </Button>
                                )}
                                <p
                                    className={cn(
                                        "max-w-56 text-muted-foreground text-xs",
                                        (proCheckoutUrl || customerPortalUrl) && "sr-only"
                                    )}
                                >
                                    Billing links are not configured yet.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {pricingOptions.map(({ title, price, cadence, description, items }) => {
                        const optionPlan = title === "Pro" ? "pro" : "free"
                        const isCurrentPlan = optionPlan === plan
                        const isProOption = optionPlan === "pro"
                        const actionLabel = isCurrentPlan
                            ? "Current Plan"
                            : isProOption
                              ? "Upgrade"
                              : "Downgrade"
                        const actionUrl = isCurrentPlan
                            ? null
                            : isProOption
                              ? proCheckoutUrl
                              : customerPortalUrl
                        const isActionDisabled = isCurrentPlan || !actionUrl

                        return (
                            <div
                                key={title}
                                className={cn(
                                    "rounded-[var(--radius-xl)] border bg-card p-6 text-card-foreground shadow-sm",
                                    isCurrentPlan && "border-primary/60"
                                )}
                            >
                                <div className="mb-6 flex items-start justify-between gap-6">
                                    <div>
                                        <h3 className="font-semibold text-xl">{title}</h3>
                                        <div className="mt-4 flex items-baseline gap-2">
                                            <span className="font-semibold text-4xl tracking-normal">
                                                {price}
                                            </span>
                                            <span className="text-muted-foreground text-sm">
                                                {cadence}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-muted-foreground text-sm">
                                            {description}
                                        </p>
                                    </div>
                                    <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-muted">
                                        {isProOption ? (
                                            <Crown className="size-5" />
                                        ) : (
                                            <Wallet className="size-5" />
                                        )}
                                    </div>
                                </div>

                                <ul className="mb-6 space-y-3">
                                    {items.map((item) => (
                                        <li
                                            key={item}
                                            className="flex items-center gap-3 text-muted-foreground text-sm"
                                        >
                                            <Check className="size-4 text-emerald-500" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    asChild={Boolean(actionUrl) && !isCurrentPlan}
                                    variant={isCurrentPlan ? "secondary" : "default"}
                                    disabled={isActionDisabled}
                                    className="w-full rounded-[var(--radius-lg)]"
                                >
                                    {actionUrl && !isCurrentPlan ? (
                                        <a
                                            href={actionUrl}
                                            target={isProOption ? undefined : "_blank"}
                                            rel={isProOption ? undefined : "noreferrer"}
                                        >
                                            {actionLabel}
                                        </a>
                                    ) : (
                                        <span>{actionLabel}</span>
                                    )}
                                </Button>
                            </div>
                        )
                    })}
                </div>

                <PrototypeCreditsCard
                    summary={creditSummary}
                    isLoading={isCreditSummaryLoading}
                    isRefreshing={isRefreshing}
                    shouldShowDevCreditPlanToggle={false}
                    isUpdatingCreditPlan={isUpdatingCreditPlan}
                    devCreditState={devCreditState}
                    isUpdatingDevCreditState={isUpdatingDevCreditState}
                    onSetDevCreditState={setDevCreditState}
                    onRefresh={refreshCredits}
                    upgradeUrl={proCheckoutUrl}
                />
            </div>
        </SettingsLayout>
    )
}
