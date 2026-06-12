"use client"

import { Check, KeyRound, Sparkles } from "lucide-react"

import { pricingOptions } from "@/components/landing-page/content"
import { SectionHead, SignInButton, Tile } from "@/components/landing-page/shared"

export function PricingSection() {
    return (
        <section id="byok" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead centered title="Flexible access without lock-in.">
                    Use SilkChat's managed credits when you want setup-free access, or bring your
                    own provider keys when you want direct control.
                </SectionHead>

                <div className="grid gap-4 md:grid-cols-2">
                    {pricingOptions.map(({ title, description, items }, index) => (
                        <Tile key={title} className="p-7">
                            <div className="mb-6 flex items-start justify-between gap-6">
                                <div>
                                    <h3 className="font-medium text-2xl [color:var(--landing-fg)]">
                                        {title}
                                    </h3>
                                    <p className="mt-2 [color:var(--landing-muted)]">
                                        {description}
                                    </p>
                                </div>
                                <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
                                    {index === 0 ? (
                                        <Sparkles className="size-5" />
                                    ) : (
                                        <KeyRound className="size-5" />
                                    )}
                                </div>
                            </div>
                            <ul className="mb-7 space-y-3">
                                {items.map((item) => (
                                    <li
                                        key={item}
                                        className="flex items-center gap-3 text-sm [color:var(--landing-muted)]"
                                    >
                                        <Check className="size-4 text-emerald-400" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <SignInButton
                                variant={index === 0 ? "default" : "outline"}
                                className="w-full"
                            >
                                {index === 0 ? "Sign up" : "Configure BYOK"}
                            </SignInButton>
                        </Tile>
                    ))}
                </div>
            </div>
        </section>
    )
}
