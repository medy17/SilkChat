"use client"

import { proofItems, providers } from "@/components/landing-page/content"
import { SectionHead } from "@/components/landing-page/shared"

export function ProvidersSection() {
    return (
        <section
            id="providers"
            className="border-t py-16 [background:var(--landing-bg)] [border-color:var(--landing-border)] md:py-24"
        >
            <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
                <div>
                    <SectionHead
                        className="mb-8"
                        title={
                            <>
                                Countless models
                                <br />
                                <span className="[color:var(--landing-muted)]">
                                    All on SilkChat
                                </span>
                            </>
                        }
                    >
                        Your favorite AI models, together. Write, code, and explore with the right
                        model for every conversation.
                    </SectionHead>

                    <ul className="flex flex-col gap-3.5">
                        {proofItems.map(({ label, Icon }) => (
                            <li
                                key={label}
                                className="flex items-center gap-3 text-sm leading-6 [color:var(--landing-muted)]"
                            >
                                <span
                                    aria-hidden="true"
                                    className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]"
                                >
                                    <Icon className="size-4" />
                                </span>
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>

                <ul
                    aria-label="Featured AI models"
                    className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-10 sm:gap-y-12"
                >
                    {providers.map(({ name, command, Icon }) => (
                        <li
                            key={name}
                            className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:gap-4"
                        >
                            <div
                                aria-hidden="true"
                                className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] [background:var(--landing-surface-stronger)] [color:var(--landing-fg)]"
                            >
                                <Icon className="size-7" />
                            </div>
                            <div className="min-w-0">
                                <div className="mb-1 text-sm [color:var(--landing-muted)]">
                                    {name}
                                </div>
                                <div className="text-balance font-medium text-lg leading-snug [color:var(--landing-fg)] sm:text-xl">
                                    {command}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}
