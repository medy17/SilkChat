"use client"

import { useGSAP } from "@gsap/react"
import { Link } from "@tanstack/react-router"
import gsap from "gsap"
import { ArrowRight } from "lucide-react"
import { useRef } from "react"

import { GithubIcon } from "@/components/brand-icons"
import { Galaxy } from "@/components/landing-page/galaxy/galaxy"
import { LogoMark } from "@/components/logo"
import { MagneticButton } from "@/components/magnetic-button"
import { Button } from "@/components/ui/button"

export function HeroSection() {
    const heroRef = useRef<HTMLDivElement>(null)
    const copyRef = useRef<HTMLDivElement>(null)
    const subtitleRef = useRef<HTMLParagraphElement>(null)
    const ctaRef = useRef<HTMLDivElement>(null)

    useGSAP(
        () => {
            const tl = gsap.timeline()
            tl.fromTo(
                ".hero-logo",
                { y: 80, opacity: 0, scale: 0.9, filter: "blur(12px)" },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    filter: "blur(0px)",
                    duration: 1.2,
                    ease: "power4.out",
                    delay: 0.1,
                    clearProps: "willChange"
                }
            )
                .fromTo(
                    subtitleRef.current,
                    { y: 30, opacity: 0, filter: "blur(12px)" },
                    {
                        y: 0,
                        opacity: 1,
                        filter: "blur(0px)",
                        duration: 1.2,
                        ease: "power3.out",
                        clearProps: "willChange"
                    },
                    "-=1"
                )
                .fromTo(
                    ctaRef.current,
                    { y: 40, opacity: 0, scale: 0.8 },
                    {
                        y: 0,
                        opacity: 1,
                        scale: 1,
                        duration: 1.5,
                        ease: "elastic.out(1, 0.4)",
                        clearProps: "willChange"
                    },
                    "-=1"
                )
        },
        { scope: heroRef }
    )

    return (
        <section
            id="hero"
            ref={heroRef}
            className="relative flex min-h-svh items-start overflow-hidden px-6 pt-28 pb-12 lg:items-center lg:pt-24"
        >
            <Galaxy copyRef={copyRef} className="absolute inset-0" />

            <div
                ref={copyRef}
                className="pointer-events-none relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center lg:items-start lg:text-left"
            >
                <div className="flex w-full flex-col items-center lg:max-w-xl lg:items-start">
                    <h1
                        data-galaxy-avoid
                        className="hero-logo pointer-events-auto mb-8 flex w-full max-w-[min(88vw,44rem)] items-center justify-center text-foreground lg:justify-start"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <span className="sr-only">SilkChat</span>
                        <LogoMark className="h-auto w-full" />
                    </h1>

                    <p
                        ref={subtitleRef}
                        data-galaxy-avoid
                        className="pointer-events-auto mb-12 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl"
                        style={{ willChange: "transform, opacity" }}
                    >
                        One platform. Every model. Switch between GPT, Claude, Gemini, and dozens
                        more — with web search, image generation, and live code previews built right
                        in.
                    </p>

                    <div
                        ref={ctaRef}
                        data-galaxy-avoid
                        className="pointer-events-auto flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <MagneticButton>
                            <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                                <Button
                                    size="lg"
                                    className="h-14 px-8 font-semibold text-lg shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                                >
                                    Get Started Free
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                        </MagneticButton>
                        <a
                            href="https://github.com/medy17/silkchat"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-14 gap-2 px-8 font-semibold text-lg transition-all hover:scale-105 active:scale-95"
                            >
                                <GithubIcon className="h-5 w-5" />
                                Star on GitHub
                            </Button>
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}
