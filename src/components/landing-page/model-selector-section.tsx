"use client"

import { ArrowRight, Check, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { providers } from "@/components/landing-page/content"
import { SectionHead, SignInButton, Tile, useReducedMotion } from "@/components/landing-page/shared"
import { cn } from "@/lib/utils"

const CYCLE_MS = 2800

const providerCatalog: Record<
    string,
    { blurb: string; models: { name: string; description: string }[] }
> = {
    OpenAI: {
        blurb: "Text, vision, tools, and search",
        models: [
            {
                name: "GPT-5.5",
                description: "High-intelligence flagship model for complex, multi-step work."
            },
            {
                name: "GPT-5.4 mini",
                description: "Fast model for everyday chat, search, and tool use."
            },
            {
                name: "GPT-5.4 nano",
                description: "Lightweight model for high-volume, low-latency tasks."
            }
        ]
    },
    Claude: {
        blurb: "Deep reasoning and careful writing",
        models: [
            {
                name: "Claude 4.8 Opus",
                description: "Frontier reasoning for research, analysis, and hard problems."
            },
            {
                name: "Claude 5 Sonnet",
                description: "Balanced model for coding, writing, and daily work."
            },
            {
                name: "Claude 4.5 Haiku",
                description: "Snappy responses for quick questions and tool calls."
            }
        ]
    },
    Gemini: {
        blurb: "Multimodal chat with long context",
        models: [
            {
                name: "Gemini 3.1 Pro",
                description: "Long-context multimodal model for documents and media."
            },
            {
                name: "Gemini 3.1 Flash",
                description: "Fast multimodal responses at everyday scale."
            },
            {
                name: "Gemini 3 Flash-Lite",
                description: "Cost-efficient model for summaries and quick lookups."
            }
        ]
    },
    xAI: {
        blurb: "Real-time knowledge with attitude",
        models: [
            {
                name: "Grok 4.3",
                description: "Flagship reasoning model at breakneck speeds."
            },
            {
                name: "Grok 4.2",
                description: "Low-latency variant tuned for conversation."
            },
            {
                name: "Grok 3 mini",
                description: "Compact model for fast, inexpensive chats."
            }
        ]
    },
    DeepSeek: {
        blurb: "Open-weight reasoning powerhouses",
        models: [
            {
                name: "DeepSeek V4 Pro",
                description: "Weirdly affordable general-purpose model with strong coding chops."
            },
            {
                name: "DeepSeek V4 Flash",
                description: "Lightweight model for fast, inexpensive tasks."
            },
            {
                name: "DeepSeek V3.2",
                description: "Last gen 'flagship killer' model for everyday chat."
            }
        ]
    },
    "Z.ai": {
        blurb: "GLM models built for agents",
        models: [
            {
                name: "GLM-5.2",
                description: "Opus tier intelligence at openweight pricing."
            },
            {
                name: "GLM-5 Air",
                description: "Lighter variant for responsive everyday chat."
            },
            {
                name: "GLM-4.7",
                description: "Proven workhorse for translation and drafting."
            }
        ]
    }
}

export function ModelSelectorSection() {
    const [activeIndex, setActiveIndex] = useState(0)
    const [inView, setInView] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [hasInteracted, setHasInteracted] = useState(false)
    const sectionRef = useRef<HTMLElement>(null)
    const reducedMotion = useReducedMotion()

    useEffect(() => {
        const section = sectionRef.current
        if (!section) return

        const observer = new IntersectionObserver(
            ([entry]) => setInView(entry?.isIntersecting ?? false),
            { threshold: 0.35 }
        )
        observer.observe(section)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!inView || isHovered || hasInteracted || reducedMotion) return

        const interval = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % providers.length)
        }, CYCLE_MS)
        return () => window.clearInterval(interval)
    }, [inView, isHovered, hasInteracted, reducedMotion])

    const activeProvider = providers[activeIndex]
    const catalog = providerCatalog[activeProvider.name] ?? providerCatalog.OpenAI

    return (
        <section
            id="model-selector"
            ref={sectionRef}
            className="border-t py-24 [border-color:var(--landing-border)]"
        >
            <style>
                {`
                    @keyframes landing-model-pop {
                        from { opacity: 0; transform: translateY(6px); }
                        to { opacity: 1; transform: none; }
                    }
                `}
            </style>

            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                    <SectionHead
                        className="mb-8"
                        title="Choose the right model without leaving the thread."
                    >
                        Compare models across providers, move from chat to search to image
                        generation, and keep every response in the same conversation.
                    </SectionHead>
                    <SignInButton className="gap-2">
                        Start using them today
                        <ArrowRight className="size-4" />
                    </SignInButton>
                </div>

                <Tile
                    className="mx-auto w-full max-w-2xl"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
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
                                <button
                                    key={name}
                                    type="button"
                                    aria-label={`Show ${name} models`}
                                    aria-pressed={index === activeIndex}
                                    onClick={() => {
                                        setHasInteracted(true)
                                        setActiveIndex(index)
                                    }}
                                    className={cn(
                                        "grid cursor-pointer place-items-center rounded-l-[var(--radius-xl)] px-2 py-3 transition-colors duration-300 [color:var(--landing-muted-faint)]",
                                        index === activeIndex
                                            ? "border border-r-0 [background:var(--landing-bg)] [border-color:var(--landing-border)] [color:var(--landing-fg)]"
                                            : "hover:[color:var(--landing-muted)]"
                                    )}
                                >
                                    <Icon className="size-5" />
                                </button>
                            ))}
                        </div>
                        <div key={activeProvider.name} className="p-4">
                            <div
                                className="mb-4"
                                style={
                                    reducedMotion
                                        ? undefined
                                        : { animation: "landing-model-pop 0.4s ease both" }
                                }
                            >
                                <h3 className="font-medium [color:var(--landing-fg)]">
                                    {activeProvider.name}
                                </h3>
                                <p className="text-sm [color:var(--landing-muted-faint)]">
                                    {catalog.blurb}
                                </p>
                            </div>
                            <div className="space-y-2">
                                {catalog.models.map(({ name, description }, index) => (
                                    <div
                                        key={name}
                                        style={
                                            reducedMotion
                                                ? undefined
                                                : {
                                                      animation: "landing-model-pop 0.4s ease both",
                                                      animationDelay: `${80 + index * 70}ms`
                                                  }
                                        }
                                        className={cn(
                                            "rounded-[var(--radius-xl)] border px-3 py-3",
                                            index === 0
                                                ? "[background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]"
                                                : "border-transparent hover:[background:var(--landing-surface)]"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 font-medium [color:var(--landing-fg)]">
                                            {name}
                                            {index === 0 ? <Check className="size-4" /> : null}
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm [color:var(--landing-muted-faint)]">
                                            {description}
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
