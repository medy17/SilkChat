"use client"

import { Button } from "@/components/ui/button"
import { useGSAP } from "@gsap/react"
import { Link } from "@tanstack/react-router"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ArrowRight, Check, Search } from "lucide-react"
import { useRef } from "react"

import {
    ClaudeIcon,
    DeepSeekIcon,
    GeminiIcon,
    OpenAIIcon,
    XAIIcon,
    ZAIIcon
} from "@/components/brand-icons"

gsap.registerPlugin(ScrollTrigger)

export function ProvidersSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".providers-header",
                { y: 40, opacity: 0, filter: "blur(10px)" },
                {
                    y: 0,
                    opacity: 1,
                    filter: "blur(0px)",
                    duration: 1,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 75%"
                    },
                    clearProps: "willChange"
                }
            )

            gsap.fromTo(
                ".providers-mockup",
                { y: 50, opacity: 0, scale: 0.95 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 1.2,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 65%"
                    },
                    clearProps: "willChange"
                }
            )
        },
        { scope: sectionRef }
    )

    return (
        <section
            id="providers"
            ref={sectionRef}
            className="flex min-h-[70vh] snap-start items-center justify-center bg-background px-6 py-12 md:py-24"
        >
            <div className="container mx-auto max-w-4xl">
                <div
                    className="providers-header mb-12 text-center"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">
                        Countless Models. One Interface.
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Seamlessly switch between the best LLMs, image generators, and multimodal
                        systems from OpenAI, Google, Anthropic, and more.
                    </p>
                </div>

                <div
                    className="providers-mockup mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border/50 bg-popover shadow-2xl"
                    style={{ willChange: "transform, opacity" }}
                >
                    <div className="shrink-0 border-border/50 border-b bg-muted/50 p-3 pb-2">
                        <div className="relative">
                            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
                            <div className="flex h-10 w-full items-center rounded-md bg-secondary/60 pl-9 text-muted-foreground text-sm">
                                Search models...
                            </div>
                        </div>
                    </div>

                    <div className="grid h-[400px] grid-cols-[80px_minmax(0,1fr)]">
                        <div className="flex flex-col border-border/50 border-r bg-muted/30 p-2">
                            <div className="relative flex flex-col items-center justify-center gap-1 rounded-l-xl border-border border-y border-l bg-popover px-2 py-3 text-foreground shadow-sm">
                                <div className="flex size-7 items-center justify-center rounded-md bg-secondary/70">
                                    <OpenAIIcon className="size-4" />
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-1 rounded-l-xl px-2 py-3 text-muted-foreground opacity-50">
                                <div className="flex size-7 items-center justify-center rounded-md">
                                    <ClaudeIcon className="size-4" />
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-1 rounded-l-xl px-2 py-3 text-muted-foreground opacity-50">
                                <div className="flex size-7 items-center justify-center rounded-md">
                                    <GeminiIcon className="size-4" />
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-1 rounded-l-xl px-2 py-3 text-muted-foreground opacity-50">
                                <div className="flex size-7 items-center justify-center rounded-md">
                                    <XAIIcon className="size-4" />
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-1 rounded-l-xl px-2 py-3 text-muted-foreground opacity-50">
                                <div className="flex size-7 items-center justify-center rounded-md">
                                    <ZAIIcon className="size-4" />
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-1 rounded-l-xl px-2 py-3 text-muted-foreground opacity-50">
                                <div className="flex size-7 items-center justify-center rounded-md">
                                    <DeepSeekIcon className="size-4" />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col p-3">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-base">OpenAI</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Latest models available
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="relative cursor-pointer overflow-hidden rounded-xl border border-border bg-accent/10 px-3 py-2 text-left shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate font-medium text-base">
                                                    GPT-5.4
                                                </span>
                                                <Check className="size-4 shrink-0 text-primary" />
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                                                OpenAI's SOTA, high-intelligence flagship model for
                                                complex, multi-step tasks.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative cursor-pointer overflow-hidden rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted/50">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate font-medium text-base">
                                                    GPT-5.4 mini
                                                </span>
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                                                OpenAI's fast and intelligent model for everyday
                                                chat, search, and tool use.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative cursor-pointer overflow-hidden rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted/50">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate font-medium text-base">
                                                    GPT-5.4 nano
                                                </span>
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                                                OpenAI's fast and lightweight model for simple
                                                tasks.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                        <Button variant="default" size="lg" className="gap-2">
                            Start using them today <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    )
}
