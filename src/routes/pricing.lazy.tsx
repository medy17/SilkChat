import { Link, createLazyFileRoute } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import { CalendarX2, CircleSlash2, Mail, Percent, Receipt, RotateCcw } from "lucide-react"
import type { ReactNode } from "react"

import { pricingOptions } from "@/components/landing-page/content"
import { FooterSection } from "@/components/landing-page/footer-section"
import { PricingSection } from "@/components/landing-page/pricing-section"
import { LANDING_THEME_CSS, SilkBackdrop } from "@/components/landing-page/shared"
import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/themes/theme-switcher"
import { Button } from "@/components/ui/button"

export const Route = createLazyFileRoute("/pricing")({
    component: PricingPage
})

const SUPPORT_EMAIL = "support@silkchat.dev"
const proPrice = pricingOptions.find((option) => option.featured)?.price

const BILLING_FACTS = [
    {
        Icon: Receipt,
        title: "Billed monthly in USD",
        body: `Pro is ${proPrice} a month and renews automatically until you cancel.`
    },
    {
        Icon: Percent,
        title: "Taxes at checkout",
        body: "Any sales tax or VAT that applies where you live is added at checkout."
    },
    {
        Icon: CalendarX2,
        title: "Cancel anytime",
        body: "Cancel from your billing settings. Pro stays active until the end of the period you've paid for."
    }
]

// Mirrors Sections 7–8 of the Terms of Service; keep the two in sync.
const REFUND_GROUPS = [
    {
        Icon: RotateCcw,
        title: "When you can get a refund",
        items: [
            "You have a right to a full refund within 14 days of the purchase date if you are a customer in the EU, EEA, or UK, and you have not utilized your subscription during that time.",
            `If you were charged in error, such as a duplicate charge or a renewal after you canceled, contact us at ${SUPPORT_EMAIL}. Our team will work with you to correct reported issues in the form of partial and/or full refunds, or other appropriate remedies including usage resets.`,
            "Where your local consumer law gives you rights that can't be waived, those rights still apply and will be honored."
        ]
    },
    {
        Icon: CircleSlash2,
        title: "What isn't refunded",
        items: [
            "If you cancel your subscription, you will not receive a refund for the current or any earlier billing period. Your subscription benefits will remain available until the end of your active billing period.",
            "If we suspend or terminate your account for breaking our Terms, you are not entitled to a refund.",
            "If you issue a chargeback with your bank or credit card provider, we may suspend or terminate your account."
        ]
    }
]

const inlineLinkClass =
    "underline underline-offset-4 transition-colors [text-decoration-color:var(--landing-border-strong)] hover:[color:var(--landing-fg)]"

function IconChip({ children }: { children: ReactNode }) {
    return (
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-lg)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
            {children}
        </span>
    )
}

function PricingPage() {
    const { isAuthenticated } = useConvexAuth()

    return (
        <div className="landing-page-root flex h-dvh flex-col overflow-y-auto overflow-x-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
            <style>{LANDING_THEME_CSS}</style>

            <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2 md:px-6">
                <Link to="/" aria-label="SilkChat home">
                    <LogoMark className="h-auto w-24 md:w-32" />
                </Link>
                <div className="flex items-center space-x-1 md:space-x-2">
                    <ThemeSwitcher />
                    <div className="h-4 w-px bg-border" />
                    <Link to="/about" className="hidden sm:block">
                        <Button variant="ghost" size="sm">
                            About
                        </Button>
                    </Link>
                    {isAuthenticated ? (
                        <Link to="/">
                            <Button size="sm" className="px-4 md:px-5">
                                Open SilkChat
                            </Button>
                        </Link>
                    ) : (
                        <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                            <Button size="sm" className="px-4 md:px-5">
                                Sign In
                            </Button>
                        </Link>
                    )}
                </div>
            </header>

            <main className="flex-1">
                <PricingSection standalone signedIn={isAuthenticated} />

                <section aria-label="Billing details" className="pb-20 md:pb-28">
                    <dl className="mx-auto grid w-full max-w-4xl gap-x-10 gap-y-8 px-5 sm:grid-cols-3 md:px-8">
                        {BILLING_FACTS.map(({ Icon, title, body }) => (
                            <div key={title} className="flex gap-4 sm:flex-col">
                                <IconChip>
                                    <Icon className="size-4" />
                                </IconChip>
                                <div>
                                    <dt className="mb-1.5 font-medium [color:var(--landing-fg)]">
                                        {title}
                                    </dt>
                                    <dd className="text-sm leading-relaxed [color:var(--landing-muted)]">
                                        {body}
                                    </dd>
                                </div>
                            </div>
                        ))}
                    </dl>
                </section>

                <section
                    aria-labelledby="refund-policy"
                    className="border-t py-20 [border-color:var(--landing-border)] md:py-28"
                >
                    <div className="mx-auto grid w-full max-w-4xl gap-12 px-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 md:px-8">
                        <div className="md:sticky md:top-12 md:self-start">
                            <h2
                                id="refund-policy"
                                className="mb-5 text-balance font-medium text-3xl leading-[1.05] [color:var(--landing-fg)] md:text-4xl"
                            >
                                Refund policy
                            </h2>
                            <p className="leading-relaxed [color:var(--landing-muted)]">
                                Under our Terms, subscription payments are non-refundable by
                                default, including partial billing periods, unused usage,
                                downgrades, and cancellation.
                            </p>
                            <p className="mt-5 text-sm [color:var(--landing-muted-soft)]">
                                The full policy is in Sections 7 and 8 of our{" "}
                                <Link to="/terms-of-service" className={inlineLinkClass}>
                                    Terms of Service
                                </Link>
                                .
                            </p>
                        </div>

                        <div className="flex flex-col gap-12">
                            {REFUND_GROUPS.map(({ Icon, title, items }) => (
                                <div key={title}>
                                    <div className="mb-6 flex items-center gap-3">
                                        <IconChip>
                                            <Icon className="size-4" />
                                        </IconChip>
                                        <h3 className="font-medium text-lg [color:var(--landing-fg)]">
                                            {title}
                                        </h3>
                                    </div>
                                    <ul className="flex flex-col gap-4">
                                        {items.map((item) => (
                                            <li
                                                key={item}
                                                className="flex gap-3 text-sm leading-relaxed [color:var(--landing-muted)]"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="mt-[0.55rem] size-1.5 shrink-0 rounded-[var(--radius-sm)] [background:var(--landing-muted-faint)]"
                                                />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            <div className="relative shrink-0 overflow-hidden">
                <SilkBackdrop silkClassName="opacity-45 dark:opacity-35" />
                <section
                    aria-labelledby="billing-questions"
                    className="relative border-t py-24 [border-color:var(--landing-border)] md:py-32"
                >
                    <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-8 px-5 md:flex-row md:items-end md:justify-between md:px-8">
                        <div>
                            <h2
                                id="billing-questions"
                                className="mb-3 text-balance font-medium text-3xl leading-[1.05] [color:var(--landing-fg)] md:text-5xl"
                            >
                                Questions about billing?
                            </h2>
                            <p className="text-lg [color:var(--landing-muted)]">
                                Email us about plans, invoices, or refunds.
                            </p>
                        </div>
                        <Button
                            asChild
                            size="lg"
                            className="h-12 rounded-[var(--radius-lg)] px-5 font-semibold"
                        >
                            <a href={`mailto:${SUPPORT_EMAIL}`}>
                                <Mail className="size-4" />
                                {SUPPORT_EMAIL}
                            </a>
                        </Button>
                    </div>
                </section>
                <FooterSection />
            </div>
        </div>
    )
}
