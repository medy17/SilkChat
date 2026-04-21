"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Check, Minus } from "lucide-react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

export function ComparisonSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".comparison-content",
                { y: 40, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
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
        },
        { scope: sectionRef }
    )

    return (
        <section
            id="comparison"
            ref={sectionRef}
            className="flex min-h-[80vh] snap-start flex-col items-center justify-center bg-muted/10 px-6 py-20"
        >
            <div
                className="comparison-content container mx-auto max-w-4xl text-center"
                style={{ willChange: "transform, opacity" }}
            >
                <h2 className="mb-4 font-bold text-3xl md:text-5xl">Why SilkChat?</h2>
                <p className="mx-auto mb-12 max-w-2xl text-lg text-muted-foreground">
                    See how we stack up against traditional single-model AI subscriptions.
                </p>

                <div className="overflow-x-auto rounded-xl border border-border/50 bg-background/50">
                    <table className="w-full table-fixed border-collapse text-left text-sm md:text-base">
                        <thead className="border-border/50 border-b bg-muted/50">
                            <tr>
                                <th className="w-1/3 p-4 font-semibold text-muted-foreground">
                                    Feature
                                </th>
                                <th className="w-1/3 border-border/50 border-l bg-primary/5 p-4 font-bold text-primary">
                                    SilkChat
                                </th>
                                <th className="w-1/3 border-border/50 border-l p-4 font-semibold text-muted-foreground">
                                    Traditional AI Apps
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            <tr className="transition-colors hover:bg-muted/20">
                                <td className="p-4 text-muted-foreground">Models Available</td>
                                <td className="border-border/50 border-l bg-primary/5 p-4 font-medium">
                                    All Providers (OpenAI, Anthropic, Google, etc.)
                                </td>
                                <td className="border-border/50 border-l p-4 text-muted-foreground">
                                    Locked to a single provider
                                </td>
                            </tr>
                            <tr className="transition-colors hover:bg-muted/20">
                                <td className="p-4 text-muted-foreground">Pricing Model</td>
                                <td className="border-border/50 border-l bg-primary/5 p-4 font-medium">
                                    Credit based usage from only $8.99
                                </td>
                                <td className="border-border/50 border-l p-4 text-muted-foreground">
                                    Rigid $20/month subscription
                                </td>
                            </tr>
                            <tr className="transition-colors hover:bg-muted/20">
                                <td className="p-4 text-muted-foreground">Open Source</td>
                                <td className="border-border/50 border-l bg-primary/5 p-4 font-medium">
                                    <div className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-emerald-500" />
                                        <span>Yes</span>
                                    </div>
                                </td>
                                <td className="border-border/50 border-l p-4 text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Minus className="h-4 w-4" />
                                        <span>No</span>
                                    </div>
                                </td>
                            </tr>
                            <tr className="transition-colors hover:bg-muted/20">
                                <td className="p-4 text-muted-foreground">Data Control</td>
                                <td className="border-border/50 border-l bg-primary/5 p-4 font-medium">
                                    You own your API keys and data
                                </td>
                                <td className="border-border/50 border-l p-4 text-muted-foreground">
                                    Data used for training (often by default)
                                </td>
                            </tr>
                            <tr className="transition-colors hover:bg-muted/20">
                                <td className="p-4 text-muted-foreground">Import History</td>
                                <td className="border-border/50 border-l bg-primary/5 p-4 font-medium">
                                    <div className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-emerald-500" />
                                        <span>Import from ChatGPT, Claude, and more</span>
                                    </div>
                                </td>
                                <td className="border-border/50 border-l p-4 text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Minus className="h-4 w-4" />
                                        <span>Locked into platform</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}
