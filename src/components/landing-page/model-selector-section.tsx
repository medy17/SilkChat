"use client"

import { ArrowRight, Check, Search } from "lucide-react"
import { LayoutGroup, motion } from "motion/react"
import { useEffect, useId, useRef, useState } from "react"

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
                name: "GPT 6 Astra",
                description: "Flagship for complex coding, research, and multimodal work."
            },
            {
                name: "GPT 5.6 Sol",
                description: "Advanced reasoning, coding, and extended tool workflows."
            },
            {
                name: "GPT 5.6 Terra",
                description: "Balanced model for everyday coding, reasoning, and chat."
            }
        ]
    },
    Claude: {
        blurb: "Deep reasoning and careful writing",
        models: [
            {
                name: "Claude Fable 5.1",
                description: "Complex codebase work, scientific research, and polished documents."
            },
            {
                name: "Claude Opus 5",
                description: "Premium coding and knowledge work with planning and verification."
            },
            {
                name: "Claude Sonnet 5",
                description: "Balanced model for coding, analysis, and daily conversations."
            }
        ]
    },
    Gemini: {
        blurb: "Multimodal chat with long context",
        models: [
            {
                name: "Gemini 3.8 Flash",
                description: "Responsive multimodal coding and complex, multi-step reasoning."
            },
            {
                name: "Gemini 3.7 Flash",
                description: "Previous Flash checkpoint for multimodal coding and tool use."
            },
            {
                name: "Gemini 3.5 Flash Lite",
                description: "Fast, efficient model for extraction and high-volume workloads."
            }
        ]
    },
    xAI: {
        blurb: "Real-time knowledge with attitude",
        models: [
            {
                name: "Grok 4.6",
                description: "Multimodal reasoning flagship for coding, knowledge work, and STEM."
            },
            {
                name: "Grok 4.5",
                description: "Previous flagship for multimodal reasoning and complex tool use."
            },
            {
                name: "Grok 4.3",
                description: "Earlier reasoning model with vision and adjustable effort."
            }
        ]
    },
    DeepSeek: {
        blurb: "Open-weight reasoning powerhouses",
        models: [
            {
                name: "DeepSeek V4 Pro 0813",
                description: "Deep reasoning and repository-scale coding with long context."
            },
            {
                name: "DeepSeek V4 Flash 0731",
                description: "Fast coding and tool workflows with adjustable reasoning."
            },
            {
                name: "DeepSeek V4 Pro",
                description: "Original V4 Pro preview for deep reasoning and long coding tasks."
            }
        ]
    },
    "Z.ai": {
        blurb: "GLM models built for agents",
        models: [
            {
                name: "GLM 5.3",
                description: "Million-token reasoning for complex software engineering."
            },
            {
                name: "GLM 5.3 Flash",
                description: "Efficient multimodal coding and extended tool workflows."
            },
            {
                name: "GLM 5.2",
                description: "Long-context model for deep debugging and sustained coding work."
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
    const providerRailLayoutGroupId = useId()
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
                    <SectionHead className="mb-8" title="Change models on the fly">
                        Compare models across providers from message to message. No need for a new
                        chat.
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
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 [color:var(--landing-muted-faint)]" />
                            <div className="flex h-10 items-center rounded-[var(--radius-lg)] pl-9 text-sm [background:var(--landing-surface-strong)] [color:var(--landing-muted-faint)]">
                                Search models...
                            </div>
                        </div>
                    </div>
                    <div className="grid h-[380px] grid-cols-[3.5rem_minmax(0,1fr)] md:grid-cols-[4rem_minmax(0,1fr)]">
                        <div className="flex min-w-0 flex-col rounded-tr-[var(--radius-md)] border-t border-r bg-muted/50">
                            <LayoutGroup id={providerRailLayoutGroupId}>
                                <div className="relative flex flex-col items-center gap-1 px-1 pt-3 pb-2 md:px-2">
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
                                                "relative isolate flex size-11 min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-transparent p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                index === activeIndex
                                                    ? "text-foreground"
                                                    : "text-muted-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            {index === activeIndex && (
                                                <motion.span
                                                    aria-hidden="true"
                                                    layoutId="landing-model-selector-provider-indicator"
                                                    className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-background ring-1 ring-foreground/20 ring-inset md:bg-popover"
                                                    transition={{
                                                        duration: reducedMotion ? 0 : 0.25,
                                                        ease: [0.16, 1, 0.3, 1]
                                                    }}
                                                />
                                            )}
                                            <span
                                                aria-hidden="true"
                                                className="relative flex size-7 items-center justify-center"
                                            >
                                                <Icon className="size-5" />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </LayoutGroup>
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
