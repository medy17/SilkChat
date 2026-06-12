"use client"

import { Check } from "lucide-react"

import { useCases } from "@/components/landing-page/content"
import { SectionHead, Tile } from "@/components/landing-page/shared"

export function UseCasesSection() {
    return (
        <section id="workflows" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead centered title="Built for more than one workflow.">
                    Whether you are writing code, researching sources, generating images, or
                    building characters, SilkChat adapts to the work in front of you.
                </SectionHead>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {useCases.map(({ title, description, Icon, checks }) => (
                        <Tile key={title} className="p-6">
                            <div className="mb-5 grid size-12 place-items-center rounded-[var(--radius-lg)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
                                <Icon className="size-6" />
                            </div>
                            <h3 className="mb-3 font-medium text-xl [color:var(--landing-fg)]">
                                {title}
                            </h3>
                            <p className="mb-6 text-sm leading-6 [color:var(--landing-muted)]">
                                {description}
                            </p>
                            <ul className="space-y-2">
                                {checks.map((check) => (
                                    <li
                                        key={check}
                                        className="flex items-center gap-2 text-sm [color:var(--landing-muted)]"
                                    >
                                        <Check className="size-4 shrink-0 text-emerald-400" />
                                        {check}
                                    </li>
                                ))}
                            </ul>
                        </Tile>
                    ))}
                </div>
            </div>
        </section>
    )
}
