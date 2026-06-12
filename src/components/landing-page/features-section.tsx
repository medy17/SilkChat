"use client"

import { features } from "@/components/landing-page/content"
import { SectionHead } from "@/components/landing-page/shared"

export function FeaturesSection() {
    return (
        <section id="features" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead title="Everything you need in one chat workspace.">
                    Built for power users and teams who want the best model for every task, with
                    search, image generation, imports, artifacts, and personas built in.
                </SectionHead>

                <div className="grid gap-px overflow-hidden rounded-[var(--radius-xl)] border [background:var(--landing-border)] [border-color:var(--landing-border)] md:grid-cols-2 lg:grid-cols-3">
                    {features.map(({ title, description, Icon }) => (
                        <div
                            key={title}
                            className="min-h-56 p-6 transition-colors [background:var(--landing-bg)] hover:[background:var(--landing-surface)]"
                        >
                            <div className="mb-5 grid size-11 place-items-center rounded-[var(--radius-lg)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
                                <Icon className="size-5" />
                            </div>
                            <h3 className="mb-2 font-medium text-lg [color:var(--landing-fg)]">
                                {title}
                            </h3>
                            <p className="text-sm leading-6 [color:var(--landing-muted)]">
                                {description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
