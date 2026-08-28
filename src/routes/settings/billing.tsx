import { PrototypeCreditsCard } from "@/components/credits/prototype-credits"
import { pricingOptions } from "@/components/landing-page/content"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { usePrototypeCredits } from "@/hooks/use-prototype-credits"
import { buildLemonSqueezyCheckoutUrl } from "@/lib/billing"
import { optionalBrowserEnv } from "@/lib/browser-env"
import { cn } from "@/lib/utils"
import { useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Crown, ExternalLink, Wallet } from "lucide-react"
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
        return plan === "pro" ? [] : ["No subscription"]
    }

    if (status === "expired") {
        const endedAt = endsAt ?? renewsAt
        return ["Expired", endedAt ? `Ended on ${endedAt}` : null].filter(Boolean) as string[]
    }

    if (status === "cancelled") {
        const endsOn = endsAt ?? renewsAt
        return ["Cancelled", endsOn ? `Ends on ${endsOn}` : null].filter(Boolean) as string[]
    }

    if (status === "past_due" || status === "unpaid") {
        return ["Payment failed", renewsAt ? `Payment was due on ${renewsAt}` : "Review billing"]
    }

    if (status === "paused") {
        return ["Paused", renewsAt ? `Resumes on ${renewsAt}` : null].filter(Boolean) as string[]
    }

    if (status === "on_trial") {
        return ["Trial active", trialEndsAt ? `Trial ends on ${trialEndsAt}` : null].filter(
            Boolean
        ) as string[]
    }

    return []
}

function BillingSettingsRoute() {
    const session = useSession()
    const user = session.user
    const billingSummary = useConvexQuery(api.billing.getMyBillingSummary, user?.id ? {} : "skip")
    const {
        summary: creditSummary,
        isLoading: isCreditSummaryLoading,
        isRefreshing,
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
    const billingEmail = user?.email
    const billingName = user?.name
    const proCheckoutUrl = useMemo(() => {
        if (!checkoutUrl || !billingUserId) {
            return null
        }

        return buildLemonSqueezyCheckoutUrl({
            checkoutUrl,
            userId: billingUserId,
            email: billingEmail,
            name: billingName
        })
    }, [billingEmail, billingName, billingUserId, checkoutUrl])

    const plan = billingSummary && !("error" in billingSummary) ? billingSummary.plan : "free"
    const subscription =
        billingSummary && !("error" in billingSummary) ? billingSummary.subscription : null
    const renewsAtLabel = formatDate(subscription?.renewsAt)
    const endsAtLabel = formatDate(subscription?.endsAt)
    const trialEndsAtLabel = formatDate(subscription?.trialEndsAt)
    const subscriptionTimelineRows =
        billingSummary === undefined
            ? undefined
            : getSubscriptionTimelineRows({
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
            description="Manage your plan, Pro access, and included usage."
        >
            <div className="space-y-6">
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
                                    {items.map(({ label, Icon }) => (
                                        <li
                                            key={label}
                                            className="flex items-center gap-3 text-muted-foreground text-sm"
                                        >
                                            <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-muted text-foreground">
                                                <Icon className="size-4" />
                                            </span>
                                            {label}
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
                    devCreditState={devCreditState}
                    isUpdatingDevCreditState={isUpdatingDevCreditState}
                    onSetDevCreditState={setDevCreditState}
                    onRefresh={refreshCredits}
                    planState={subscriptionTimelineRows}
                    title={
                        <span className="flex items-center gap-2">
                            <PlanIcon className="size-5" />
                            {plan === "pro" ? "Pro Plan" : "Free Plan"}
                        </span>
                    }
                    showPlanHeader={false}
                    headerAction={
                        plan === "pro" ? (
                            <Button
                                asChild={Boolean(customerPortalUrl)}
                                disabled={!customerPortalUrl}
                                size="sm"
                            >
                                {customerPortalUrl ? (
                                    <a href={customerPortalUrl} target="_blank" rel="noreferrer">
                                        Manage subscription
                                        <ExternalLink className="size-4" />
                                    </a>
                                ) : (
                                    <span>Manage subscription</span>
                                )}
                            </Button>
                        ) : undefined
                    }
                />
            </div>
        </SettingsLayout>
    )
}
