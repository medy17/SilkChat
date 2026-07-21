"use client"

import { useGSAP } from "@gsap/react"
import { Link } from "@tanstack/react-router"
import gsap from "gsap"
import { ArrowRight, Github } from "lucide-react"
import { useRef } from "react"

import {
    ClaudeIcon,
    DeepSeekIcon,
    GeminiIcon,
    OpenAIIcon,
    XAIIcon,
    ZAIIcon
} from "@/components/brand-icons"
import { LogoMark } from "@/components/logo"
import { MagneticButton } from "@/components/magnetic-button"
import { Silk } from "@/components/react-bits/silk"
import { Button } from "@/components/ui/button"
import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { useThemeStore } from "@/lib/theme-store"

type SilkControls = {
    colorOverride?: string
    contrast: number
    noiseIntensity: number
    speed: number
    scale: number
    overlayClassName: string
}

export function HeroSection() {
    const { themeState } = useThemeStore()
    const heroRef = useRef<HTMLDivElement>(null)
    const subtitleRef = useRef<HTMLParagraphElement>(null)
    const ctaRef = useRef<HTMLDivElement>(null)
    const logosRef = useRef<HTMLDivElement>(null)
    const resolvedMode = useResolvedThemeMode(themeState.currentMode)
    const isDarkMode = resolvedMode === "dark"
    const themeSilkColor = themeState.cssVars[resolvedMode]["muted-foreground"] || "#7B7481"

    const silkControls: SilkControls = isDarkMode
        ? {
              colorOverride: "#9b969e",
              contrast: 1,
              noiseIntensity: 1.5,
              speed: 5,
              scale: 1,
              overlayClassName: "bg-background/35"
          }
        : {
              colorOverride: undefined,
              contrast: 1.06,
              noiseIntensity: 0.35,
              speed: 3.4,
              scale: 0.92,
              overlayClassName: "bg-background/35"
          }
    const silkColor = silkControls.colorOverride ?? themeSilkColor

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
                .fromTo(
                    logosRef.current?.children || [],
                    { y: 20, opacity: 0, scale: 0.5 },
                    {
                        y: 0,
                        opacity: 0.5,
                        scale: 1,
                        duration: 0.8,
                        stagger: 0.1,
                        ease: "back.out(1.5)",
                        clearProps: "willChange"
                    },
                    "-=1.2"
                )
        },
        { scope: heroRef }
    )

    return (
        <section
            id="hero"
            ref={heroRef}
            className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-12 text-center"
        >
            <div className="pointer-events-none absolute inset-0 z-10">
                <Silk
                    className="h-full w-full opacity-70 dark:opacity-55"
                    color={silkColor}
                    contrast={silkControls.contrast}
                    noiseIntensity={silkControls.noiseIntensity}
                    rotation={0}
                    scale={silkControls.scale}
                    speed={silkControls.speed}
                />
                <div className={`absolute inset-0 ${silkControls.overlayClassName}`} />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center">
                <h1
                    className="hero-logo mx-auto mb-8 flex w-full max-w-[min(88vw,44rem)] items-center justify-center text-foreground"
                    style={{ willChange: "transform, opacity" }}
                >
                    <span className="sr-only">SilkChat</span>
                    <LogoMark className="h-auto w-full" />
                </h1>

                <p
                    ref={subtitleRef}
                    className="mx-auto mb-12 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl"
                    style={{ willChange: "transform, opacity" }}
                >
                    One platform. Every model. Switch between GPT, Claude, Gemini, and dozens more —
                    with web search, image generation, and live code previews built right in.
                </p>

                <div
                    ref={ctaRef}
                    className="flex flex-col items-center justify-center gap-4 sm:flex-row"
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
                    <a href="https://github.com/medy17/silkchat" target="_blank" rel="noreferrer">
                        <Button
                            size="lg"
                            variant="outline"
                            className="h-14 gap-2 px-8 font-semibold text-lg transition-all hover:scale-105 active:scale-95"
                        >
                            <Github className="h-5 w-5" />
                            Star on GitHub
                        </Button>
                    </a>
                </div>
            </div>

            <div
                ref={logosRef}
                className="mt-12 flex flex-wrap justify-center gap-8 opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0 md:mt-20 md:gap-16"
            >
                <OpenAIIcon className="h-8 w-8" style={{ willChange: "transform, opacity" }} />
                <ClaudeIcon className="h-8 w-8" style={{ willChange: "transform, opacity" }} />
                <GeminiIcon className="h-8 w-8" style={{ willChange: "transform, opacity" }} />
                <XAIIcon className="h-8 w-8" style={{ willChange: "transform, opacity" }} />
                <DeepSeekIcon className="h-8 w-8" style={{ willChange: "transform, opacity" }} />
                <ZAIIcon className="h-8 w-8" style={{ willChange: "transform, opacity" }} />
            </div>
        </section>
    )
}
