"use client"

import { MagneticButton } from "@/components/magnetic-button"
import { Button } from "@/components/ui/button"
import { useGSAP } from "@gsap/react"
import { Link } from "@tanstack/react-router"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ArrowRight } from "lucide-react"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

export function CtaSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".cta-header",
                { y: 30, opacity: 0, scale: 0.9 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 1,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 80%"
                    },
                    clearProps: "willChange"
                }
            )
            gsap.fromTo(
                ".cta-button",
                { y: 40, opacity: 0, scale: 0.8 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 1.5,
                    ease: "elastic.out(1, 0.4)",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 70%"
                    },
                    clearProps: "willChange"
                }
            )
        },
        { scope: sectionRef }
    )

    return (
        <section
            id="cta"
            ref={sectionRef}
            className="flex min-h-screen snap-start flex-col items-center justify-center bg-primary px-6 py-20 text-center text-primary-foreground"
        >
            <div>
                <div className="cta-header" style={{ willChange: "transform, opacity" }}>
                    <h2 className="mb-6 font-bold text-4xl leading-tight tracking-tight md:text-6xl">
                        Ready to join the future of chat?
                    </h2>
                    <p className="mx-auto mb-10 max-w-2xl text-lg opacity-90 md:text-xl">
                        Join thousands of users who are already exploring the frontiers of AI with
                        SilkChat. Free to start, forever powerful.
                    </p>
                </div>
                <div className="cta-button" style={{ willChange: "transform, opacity" }}>
                    <MagneticButton>
                        <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                            <Button
                                size="lg"
                                variant="secondary"
                                className="h-16 px-10 font-bold text-xl shadow-2xl transition-all hover:scale-105 active:scale-95"
                            >
                                Get Started for Free
                                <ArrowRight className="ml-2 h-6 w-6" />
                            </Button>
                        </Link>
                    </MagneticButton>
                </div>
            </div>
        </section>
    )
}
