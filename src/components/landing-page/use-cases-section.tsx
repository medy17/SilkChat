"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Check, Code, FileText, Sparkles, VenetianMask } from "lucide-react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

export function UseCasesSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".use-case-header",
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
                ".use-case-card",
                { y: 50, opacity: 0, scale: 0.95 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 0.8,
                    stagger: 0.1,
                    ease: "back.out(1.2)",
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
            id="use-cases"
            ref={sectionRef}
            className="flex min-h-[80vh] snap-start flex-col items-center justify-center bg-muted/5 px-6 py-20"
        >
            <div className="container mx-auto max-w-6xl">
                <div
                    className="use-case-header mb-16 text-center"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">Built for everyone</h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Whether you're writing code or drafting an essay, SilkChat adapts to your
                        workflow.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div
                        className="use-case-card flex flex-col items-center rounded-xl border border-border/50 bg-background/50 p-6 text-center lg:p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                            <Code className="h-8 w-8" />
                        </div>
                        <h3 className="mb-4 font-bold text-2xl">Developers</h3>
                        <p className="mb-6 flex-1 text-muted-foreground text-sm leading-relaxed lg:text-base">
                            Compare answers across models instantly. Use Smart Artifacts to preview
                            UI components right in the chat.
                        </p>
                        <ul className="w-full space-y-2 text-left text-muted-foreground text-sm">
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-blue-500" /> Code
                                refactoring
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-blue-500" /> Live UI
                                previews
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-blue-500" /> Complex
                                debugging
                            </li>
                        </ul>
                    </div>

                    <div
                        className="use-case-card flex flex-col items-center rounded-xl border border-border/50 bg-background/50 p-6 text-center lg:p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                            <Sparkles className="h-8 w-8" />
                        </div>
                        <h3 className="mb-4 font-bold text-2xl">Creators</h3>
                        <p className="mb-6 flex-1 text-muted-foreground text-sm leading-relaxed lg:text-base">
                            Brainstorm ideas with the sharpest models, and generate breathtaking
                            images using top-tier models like FLUX.
                        </p>
                        <ul className="w-full space-y-2 text-left text-muted-foreground text-sm">
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-purple-500" /> High-res
                                image generation
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-purple-500" /> Ideation &
                                outlining
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-purple-500" /> Creative
                                feedback
                            </li>
                        </ul>
                    </div>

                    <div
                        className="use-case-card flex flex-col items-center rounded-xl border border-border/50 bg-background/50 p-6 text-center lg:p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                            <FileText className="h-8 w-8" />
                        </div>
                        <h3 className="mb-4 font-bold text-2xl">Researchers</h3>
                        <p className="mb-6 flex-1 text-muted-foreground text-sm leading-relaxed lg:text-base">
                            Utilize real-time web search to ground your questions in fact. Upload
                            dense documents for rapid analysis.
                        </p>
                        <ul className="w-full space-y-2 text-left text-muted-foreground text-sm">
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-emerald-500" /> Live web
                                grounding
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-emerald-500" /> Document
                                analysis
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-emerald-500" /> Source
                                summarization
                            </li>
                        </ul>
                    </div>

                    <div
                        className="use-case-card flex flex-col items-center rounded-xl border border-border/50 bg-background/50 p-6 text-center lg:p-8"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500">
                            <VenetianMask className="h-8 w-8" />
                        </div>
                        <h3 className="mb-4 font-bold text-2xl">Roleplayers</h3>
                        <p className="mb-6 flex-1 text-muted-foreground text-sm leading-relaxed lg:text-base">
                            Immerse yourself in infinite worlds. Build custom Personas with deep
                            backstories and distinct, unfiltered voices.
                        </p>
                        <ul className="w-full space-y-2 text-left text-muted-foreground text-sm">
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-pink-500" /> Deep character
                                prompts
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-pink-500" /> Consistent
                                persona voice
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-pink-500" /> Unfiltered
                                model choices
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    )
}
