"use client"

import { ArrowRight, Check, Search } from "lucide-react"

import { providers } from "@/components/landing-page/content"
import { SectionHead, SignInButton, Tile } from "@/components/landing-page/shared"
import { cn } from "@/lib/utils"

export function ModelSelectorSection() {
    return (
        <section
            id="model-selector"
            className="border-t py-24 [border-color:var(--landing-border)]"
        >
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                    <SectionHead title="Choose the right model without leaving the thread.">
                        Compare models across providers, move from chat to search to image
                        generation, and keep every response in the same conversation.
                    </SectionHead>
                    <SignInButton className="gap-2">
                        Start using them today
                        <ArrowRight className="size-4" />
                    </SignInButton>
                </div>

                <Tile className="mx-auto w-full max-w-2xl">
                    <div className="border-b p-3 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                        <div className="relative">
                            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 [color:var(--landing-muted-faint)]" />
                            <div className="flex h-10 items-center rounded-[var(--radius-lg)] pl-9 text-sm [background:var(--landing-surface-strong)] [color:var(--landing-muted-faint)]">
                                Search models...
                            </div>
                        </div>
                    </div>
                    <div className="grid h-[380px] grid-cols-[76px_minmax(0,1fr)]">
                        <div className="flex flex-col border-r p-2 [background:var(--landing-surface)] [border-color:var(--landing-border)]">
                            {providers.map(({ name, Icon }, index) => (
                                <div
                                    key={name}
                                    className={cn(
                                        "grid place-items-center rounded-l-[var(--radius-xl)] px-2 py-3 [color:var(--landing-muted-faint)]",
                                        index === 0 &&
                                            "border border-r-0 [background:var(--landing-bg)] [border-color:var(--landing-border)] [color:var(--landing-fg)]"
                                    )}
                                >
                                    <Icon className="size-5" />
                                </div>
                            ))}
                        </div>
                        <div className="p-4">
                            <div className="mb-4">
                                <h3 className="font-medium [color:var(--landing-fg)]">OpenAI</h3>
                                <p className="text-sm [color:var(--landing-muted-faint)]">
                                    Text, vision, tools, and search
                                </p>
                            </div>
                            <div className="space-y-2">
                                {["GPT-5.5", "GPT-5.4 mini", "GPT-5.4 nano"].map((model, index) => (
                                    <div
                                        key={model}
                                        className={cn(
                                            "rounded-[var(--radius-xl)] border px-3 py-3",
                                            index === 0
                                                ? "[background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]"
                                                : "border-transparent hover:[background:var(--landing-surface)]"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 font-medium [color:var(--landing-fg)]">
                                            {model}
                                            {index === 0 ? <Check className="size-4" /> : null}
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm [color:var(--landing-muted-faint)]">
                                            {index === 0
                                                ? "High-intelligence flagship model for complex, multi-step work."
                                                : "Fast model for everyday chat, search, and tool use."}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Tile>
            </div>
        </section>
    )
}
