"use client"

import { FileUp, Github, LockKeyhole, ShieldCheck } from "lucide-react"
import type { ComponentType } from "react"

import { SectionHead, Tile } from "@/components/landing-page/shared"
import { Button } from "@/components/ui/button"

export function SecuritySection() {
    return (
        <section id="privacy" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead centered title="Audit it. Host it. Fork it.">
                    SilkChat is built for privacy and transparency. Use your own keys, review the
                    source, and keep provider-level retention under your control.
                </SectionHead>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <Tile className="p-0">
                        <div className="flex items-center gap-2 border-b px-4 py-3 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                            <span className="size-2.5 rounded-full [background:var(--landing-muted-faint)]" />
                            <span className="size-2.5 rounded-full [background:var(--landing-muted-faint)]" />
                            <span className="size-2.5 rounded-full [background:var(--landing-muted-faint)]" />
                            <span className="ml-3 font-mono text-xs [color:var(--landing-muted-faint)]">
                                ~/silkchat
                            </span>
                        </div>
                        <div className="space-y-1 p-6 font-mono text-sm leading-7">
                            <div className="[color:var(--landing-muted-soft)]">
                                <span className="[color:var(--landing-fg)]">$</span> gh repo clone
                                medy17/silkchat
                            </div>
                            <div className="[color:var(--landing-muted-faint)]">
                                Cloned SilkChat into ./silkchat
                            </div>
                            <div className="[color:var(--landing-muted-soft)]">
                                <span className="[color:var(--landing-fg)]">$</span> bun install
                            </div>
                            <div className="[color:var(--landing-muted-faint)]">
                                Dependencies installed
                            </div>
                            <div className="[color:var(--landing-muted-soft)]">
                                <span className="[color:var(--landing-fg)]">$</span> bun run dev
                            </div>
                            <div className="[color:var(--landing-muted-faint)]">
                                SilkChat dev server{" "}
                                <span className="[color:var(--landing-fg)]">
                                    http://localhost:3000
                                </span>
                            </div>
                        </div>
                    </Tile>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {[
                            ["Encrypted keys", "Keys are stored securely.", LockKeyhole],
                            ["Open source", "Audit the code and host it yourself.", Github],
                            [
                                "BYOK controls",
                                "Use provider-level retention policies.",
                                ShieldCheck
                            ],
                            ["Portable chats", "Import conversations from other tools.", FileUp]
                        ].map(([title, description, Icon]) => {
                            const IconComponent = Icon as ComponentType<{ className?: string }>

                            return (
                                <Tile key={title as string} className="p-5">
                                    <IconComponent className="mb-5 size-6 [color:var(--landing-fg)]" />
                                    <div className="font-medium [color:var(--landing-fg)]">
                                        {title as string}
                                    </div>
                                    <p className="mt-2 text-sm [color:var(--landing-muted-faint)]">
                                        {description as string}
                                    </p>
                                </Tile>
                            )
                        })}
                    </div>
                </div>

                <div className="mt-8 flex justify-center">
                    <a href="https://github.com/medy17/silkchat" target="_blank" rel="noreferrer">
                        <Button
                            variant="outline"
                            className="h-11 rounded-[var(--radius-lg)] border bg-transparent [border-color:var(--landing-border)] [color:var(--landing-fg)] hover:[background:var(--landing-surface-strong)] hover:[color:var(--landing-fg)]"
                        >
                            <Github className="mr-2 size-4" />
                            View source code
                        </Button>
                    </a>
                </div>
            </div>
        </section>
    )
}
