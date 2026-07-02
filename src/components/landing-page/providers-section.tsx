"use client"

import { Check } from "lucide-react"

import { proofItems, providers } from "@/components/landing-page/content"
import { SectionHead } from "@/components/landing-page/shared"

export function ProvidersSection() {
    return (
        <section
            id="providers"
            className="border-t py-24 [background:var(--landing-bg)] [border-color:var(--landing-border)]"
        >
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead title="Countless models. One interface.">
                    Seamlessly switch between the best LLMs, image generators, and multimodal
                    systems from OpenAI, Google, Anthropic, xAI, DeepSeek, and more.
                </SectionHead>

                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-xl)] border [background:var(--landing-border)] [border-color:var(--landing-border)] md:grid-cols-3 lg:grid-cols-6">
                    {providers.map(({ name, command, Icon }) => (
                        <div
                            key={name}
                            className="flex items-center gap-4 p-5 transition-colors [background:var(--landing-surface)] hover:[background:var(--landing-surface-strong)]"
                        >
                            <div className="grid size-8 shrink-0 place-items-center [color:var(--landing-fg)]">
                                <Icon className="size-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="font-medium text-sm [color:var(--landing-fg)]">
                                    {name}
                                </div>
                                <div className="truncate font-medium text-[14px] [color:var(--landing-muted-faint)]">
                                    {command}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-5 pt-6 [border-color:var(--landing-border)]">
                    {proofItems.map((item) => (
                        <div
                            key={item}
                            className="inline-flex items-center gap-2 text-sm [color:var(--landing-muted)]"
                        >
                            <Check className="size-4 text-emerald-400" />
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
