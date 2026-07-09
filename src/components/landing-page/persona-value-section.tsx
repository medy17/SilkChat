"use client"

import { personaValueBlocks } from "@/components/landing-page/persona-content"
import { SectionHead, Tile } from "@/components/landing-page/shared"

export function PersonaValueSection() {
    return (
        <section id="persona-why" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead centered title="Far More Than a Prompt.">
                    Anyone can paste "act as a vampire" into a system prompt. It works — for about
                    twenty messages. Personas are built for the long game.
                </SectionHead>

                <div className="grid gap-4 md:grid-cols-3">
                    {personaValueBlocks.map(({ title, description, Icon }) => (
                        <Tile key={title} className="p-6">
                            <div className="mb-5 grid size-12 place-items-center rounded-[var(--radius-lg)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
                                <Icon className="size-6" />
                            </div>
                            <h3 className="mb-3 font-medium text-xl [color:var(--landing-fg)]">
                                {title}
                            </h3>
                            <p className="text-sm leading-6 [color:var(--landing-muted)]">
                                {description}
                            </p>
                        </Tile>
                    ))}
                </div>
            </div>
        </section>
    )
}
