"use client"

import { MagicCard } from "@/components/magic-cards"
import { Button } from "@/components/ui/button"
import { useGSAP } from "@gsap/react"
import { Link } from "@tanstack/react-router"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Check } from "lucide-react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

export function PricingSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".pricing-header",
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
                ".pricing-card",
                { y: 60, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 1,
                    stagger: 0.2,
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
            id="byok"
            ref={sectionRef}
            className="flex min-h-[130vh] snap-start flex-col items-center justify-center bg-muted/20 px-6 py-20 md:min-h-screen"
        >
            <div className="container mx-auto max-w-5xl">
                <div
                    className="pricing-header mb-16 text-center"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">Flexible Access</h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Use our managed service or bring your own infrastructure.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-16 pb-10 md:grid-cols-2 md:gap-8">
                    <div
                        className="flex snap-center flex-col md:snap-align-none"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <MagicCard
                            gradientFrom="rgba(var(--primary), 0.1)"
                            className="pricing-card flex flex-1 flex-col rounded-xl border-primary/50 bg-background/50 p-8 shadow-2xl"
                        >
                            <div className="mb-6">
                                <h3 className="font-bold text-2xl">Internal Credits</h3>
                                <p className="mt-2 text-muted-foreground">
                                    Perfect for getting started without managing any keys.
                                </p>
                            </div>
                            <div className="mb-8 space-y-4">
                                {[
                                    "Access all premium models",
                                    "Shared credit pool",
                                    "Pay only for what you use",
                                    "No configuration required"
                                ].map((item) => (
                                    <div key={item} className="flex items-center gap-3">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/20 text-primary">
                                            <Check className="h-3 w-3" />
                                        </div>
                                        <span className="text-sm">{item}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto">
                                <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                                    <Button className="w-full">Sign Up</Button>
                                </Link>
                            </div>
                        </MagicCard>
                    </div>

                    <div
                        className="flex snap-center flex-col pt-10 md:snap-align-none md:pt-0"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <MagicCard className="pricing-card flex flex-1 flex-col rounded-xl bg-background/50 p-8">
                            <div className="mb-6">
                                <h3 className="font-bold text-2xl">Bring Your Own Key</h3>
                                <p className="mt-2 text-muted-foreground">
                                    Full control over your data and costs.
                                </p>
                            </div>
                            <div className="mb-8 space-y-4">
                                {[
                                    "Connect OpenAI, Anthropic, Google",
                                    "Zero platform markup",
                                    "Your own usage limits",
                                    "Direct provider billing"
                                ].map((item) => (
                                    <div key={item} className="flex items-center gap-3">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                            <Check className="h-3 w-3" />
                                        </div>
                                        <span className="text-sm">{item}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto">
                                <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                                    <Button variant="outline" className="w-full">
                                        Configure BYOK
                                    </Button>
                                </Link>
                            </div>
                        </MagicCard>
                    </div>
                </div>
            </div>
        </section>
    )
}
