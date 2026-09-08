"use client"

import { Crown, Wallet } from "lucide-react"

import { pricingOptions } from "@/components/landing-page/content"
import { SectionHead, SignInButton, Tile } from "@/components/landing-page/shared"

export function PricingSection() {
    return (
        <section id="pricing" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead centered title="Simple Pricing. Serious AI Access.">
                    Start free. Upgrade Anytime.
                </SectionHead>

                <div className="mx-auto grid max-w-4xl gap-x-4 gap-y-8 md:grid-cols-2">
                    {pricingOptions.map(
                        ({ title, price, cadence, cta, featured, description, items }) => (
                            <Tile
                                key={title}
                                className={
                                    featured
                                        ? "relative overflow-visible p-7 ring-1 [--tw-ring-color:var(--landing-fg)] [background:var(--landing-surface-strong)] [border-color:var(--landing-fg)]"
                                        : "p-7"
                                }
                            >
                                {featured && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-xl)] px-4 py-1 font-semibold text-xs [background:var(--landing-fg)] [color:var(--landing-bg)]">
                                        Popular
                                    </span>
                                )}
                                <div className="mb-6 flex items-start justify-between gap-6">
                                    <div>
                                        <h3 className="font-medium text-2xl [color:var(--landing-fg)]">
                                            {title}
                                        </h3>
                                        <div className="mt-4 flex items-baseline gap-2">
                                            <span className="font-medium text-5xl tracking-normal [color:var(--landing-fg)]">
                                                {price}
                                            </span>
                                            <span className="[color:var(--landing-muted-soft)]">
                                                {cadence}
                                            </span>
                                        </div>
                                        <p className="mt-4 [color:var(--landing-muted)]">
                                            {description}
                                        </p>
                                    </div>
                                    <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
                                        {featured ? (
                                            <Crown className="size-5" />
                                        ) : (
                                            <Wallet className="size-5" />
                                        )}
                                    </div>
                                </div>
                                <ul className="mb-7 space-y-3">
                                    {items.map(({ label, Icon }) => (
                                        <li
                                            key={label}
                                            className="flex items-center gap-3 text-sm [color:var(--landing-muted)]"
                                        >
                                            <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
                                                <Icon className="size-4" />
                                            </span>
                                            {label}
                                        </li>
                                    ))}
                                </ul>
                                <SignInButton
                                    variant={featured ? "default" : "outline"}
                                    className="w-full"
                                >
                                    {cta}
                                </SignInButton>
                            </Tile>
                        )
                    )}
                </div>
            </div>
        </section>
    )
}
