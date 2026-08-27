"use client"

import { ArrowRight } from "lucide-react"

import { GithubIcon } from "@/components/brand-icons"
import { SignInButton } from "@/components/landing-page/shared"
import { Button } from "@/components/ui/button"

export function CtaSection() {
    return (
        <section
            id="start"
            className="relative border-t py-28 text-center [border-color:var(--landing-border)]"
        >
            <div className="relative z-10 mx-auto max-w-4xl px-5">
                <h2 className="mx-auto mb-5 max-w-3xl text-balance font-medium text-4xl leading-[1.05] tracking-normal [color:var(--landing-fg)] md:text-6xl">
                    One interface for every model you trust.
                </h2>
                <p className="mx-auto mb-9 max-w-2xl text-lg [color:var(--landing-muted)]">
                    Start free, connect the providers you already use, and keep chats, artifacts,
                    search, images, imports, and personas in one place.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <SignInButton className="gap-2">
                        Get started free
                        <ArrowRight className="size-4" />
                    </SignInButton>
                    <a href="https://github.com/medy17/silkchat" target="_blank" rel="noreferrer">
                        <Button
                            size="lg"
                            variant="outline"
                            className="h-12 rounded-[var(--radius-lg)] border bg-transparent px-5 [border-color:var(--landing-border)] [color:var(--landing-fg)] hover:[background:var(--landing-surface-strong)] hover:[color:var(--landing-fg)]"
                        >
                            <GithubIcon className="mr-2 size-4" />
                            Star on GitHub
                        </Button>
                    </a>
                </div>
            </div>
        </section>
    )
}
