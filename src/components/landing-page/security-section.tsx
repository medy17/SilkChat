"use client"

import { Button } from "@/components/ui/button"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Check, Github, ShieldCheck } from "lucide-react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

export function SecuritySection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".security-content",
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
            id="security"
            ref={sectionRef}
            className="flex min-h-screen snap-start flex-col items-center justify-center bg-background px-6 py-20"
        >
            <div
                className="security-content container mx-auto max-w-4xl"
                style={{ willChange: "transform, opacity" }}
            >
                <div className="mb-12 text-center">
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">Built for Privacy</h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Your data and infrastructure are entirely in your control.
                    </p>
                </div>
                <div className="grid grid-cols-1 items-center gap-8 rounded-xl border border-border/50 bg-muted/30 p-8 md:grid-cols-2 md:p-12">
                    <div>
                        <div className="mb-6 inline-flex items-center justify-center rounded-lg bg-emerald-500/10 p-3 text-emerald-500">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <h3 className="mb-4 font-bold text-3xl">Secure & Transparent</h3>
                        <p className="mb-6 text-muted-foreground">
                            When you use BYOK, your API requests go directly to the provider. We
                            don't act as a man-in-the-middle, meaning your sensitive conversations
                            are never logged by us.
                        </p>
                        <a
                            href="https://github.com/medy17/silkchat"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Button variant="outline" className="gap-2">
                                <Github className="h-4 w-4" />
                                View Source Code
                            </Button>
                        </a>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-background p-4 shadow-sm">
                            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                            <div>
                                <p className="font-semibold">Local API Keys</p>
                                <p className="text-muted-foreground text-sm">
                                    Keys are stored securely in your browser.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-background p-4 shadow-sm">
                            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                            <div>
                                <p className="font-semibold">Open Source</p>
                                <p className="text-muted-foreground text-sm">
                                    Audit our code. Host it yourself if you prefer.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
