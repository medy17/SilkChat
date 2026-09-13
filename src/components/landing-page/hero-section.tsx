"use client"

import { Link } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { animate, useMotionValue, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Silk } from "@/components/react-bits/silk"
import { Button } from "@/components/ui/button"
import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { useThemeStore } from "@/lib/theme-store"
import { Sculpture, SceneBoundary } from "./sculpture"
import type { LandingScrollProps } from "./use-landing-scroll"

export function HeroSection({ containerRef }: LandingScrollProps) {
    const sectionRef = useRef<HTMLElement>(null)
    const progress = useMotionValue(0.12)
    const reduced = useReducedMotion() === true
    const [sculptureReady, setSculptureReady] = useState(false)
    const onSculptureReady = useCallback(() => setSculptureReady(true), [])
    const { themeState } = useThemeStore()
    const mode = useResolvedThemeMode(themeState.currentMode)
    const dark = mode === "dark"
    const [inView, setInView] = useState(true)
    const [silkFailed, setSilkFailed] = useState(false)
    const onSilkFailure = useCallback(() => setSilkFailed(true), [])

    useEffect(() => {
        if (!sculptureReady || reduced || !inView) return
        // Play after the first rendered frame, then stay assembled. Scrolling
        // only pauses an offscreen reveal; it never controls the model's pose.
        const animation = animate(progress, 0.35, { duration: 1.2, ease: "easeOut" })
        return () => animation.stop()
    }, [sculptureReady, reduced, inView, progress])

    useEffect(() => {
        if (!sectionRef.current) return
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
            root: containerRef.current
        })
        observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [containerRef])

    return (
        <section id="hero" ref={sectionRef} className="landing-hero">
            <div className="landing-hero-silk" aria-hidden="true">
                {!silkFailed && (
                    <SceneBoundary onFailure={onSilkFailure}>
                        <Silk
                            className="h-full w-full opacity-70 dark:opacity-55"
                            color={
                                themeState.cssVars[mode]["muted-foreground"] ||
                                "var(--muted-foreground)"
                            }
                            contrast={dark ? 1 : 1.06}
                            noiseIntensity={dark ? 1.5 : 0.35}
                            scale={dark ? 1 : 0.92}
                            speed={dark ? 5 : 3.4}
                            paused={reduced || !inView}
                        />
                    </SceneBoundary>
                )}
                <div className="absolute inset-0 bg-background/35" />
            </div>
            <div className="landing-wrap landing-hero-composition">
                <div className="landing-hero-copy">
                    <h1>
                        Your models.
                        <br />
                        One conversation.
                    </h1>
                    <p>
                        Write, research, code, and create images with Claude, GPT, Gemini, and more.
                    </p>
                    <Button asChild size="lg" className="landing-primary h-12 px-6">
                        <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                            Get started free <ArrowUpRight className="size-4" />
                        </Link>
                    </Button>
                </div>
                <Sculpture
                    kind="conversation"
                    progress={progress}
                    reduced={reduced}
                    containerRef={containerRef}
                    onReady={onSculptureReady}
                />
            </div>
        </section>
    )
}
