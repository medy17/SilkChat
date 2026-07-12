"use client"

import { Link } from "@tanstack/react-router"
import { type RefObject, useEffect, useRef, useState } from "react"

import { PERSONA_ONBOARDING_PATH } from "@/lib/persona-onboarding"
import { cn } from "@/lib/utils"
import { FooterSection } from "./landing-page/footer-section"
import { PersonaChatDemoSection } from "./landing-page/persona-chat-demo-section"
import { PersonaCtaSection } from "./landing-page/persona-cta-section"
import { PersonaHeroSection } from "./landing-page/persona-hero-section"
import { PersonaValueSection } from "./landing-page/persona-value-section"
import { PersonaWalkthroughSection } from "./landing-page/persona-walkthrough-section"
import { PricingSection } from "./landing-page/pricing-section"
import { SilkBackdrop } from "./landing-page/shared"
import { LogoMark, LogoSymbol } from "./logo"
import { SPLASH_EXIT_DURATION_MS, SPLASH_FILL_DURATION_MS, SplashScreen } from "./splash-screen"
import { ThemeSwitcher } from "./themes/theme-switcher"
import { Button } from "./ui/button"

function PersonaLandingNav({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
    // Ported from the primary landing StickyNav: fade in a blurred background and
    // swap the wordmark for the compact symbol once the hero scrolls away, and
    // collapse the bar when scrolling down / reveal it when scrolling up.
    const [isNavVisible, setIsNavVisible] = useState(true)
    const [isHero, setIsHero] = useState(true)
    const lastScrollY = useRef(0)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let ticking = false

        const handleScroll = () => {
            if (ticking) return
            ticking = true

            window.requestAnimationFrame(() => {
                const currentScrollY = container.scrollTop
                setIsNavVisible(currentScrollY <= lastScrollY.current || currentScrollY <= 100)
                lastScrollY.current = currentScrollY

                const heroEl = document.getElementById("persona-hero")
                setIsHero(
                    heroEl ? heroEl.getBoundingClientRect().bottom > 120 : currentScrollY < 200
                )

                ticking = false
            })
        }

        container.addEventListener("scroll", handleScroll, { passive: true })
        handleScroll()

        return () => container.removeEventListener("scroll", handleScroll)
    }, [containerRef])

    return (
        <nav
            className={cn(
                "fixed top-0 z-50 flex w-full items-center justify-between px-4 py-2 transition-[transform,background-color,backdrop-filter] duration-500 ease-in-out md:px-6",
                isHero ? "bg-transparent backdrop-blur-none" : "bg-background/40 backdrop-blur-md",
                isNavVisible ? "translate-y-0" : "-translate-y-full"
            )}
        >
            <Link to="/" aria-label="SilkChat home" className="relative flex items-center">
                <LogoMark
                    className={cn(
                        "h-auto w-28 text-foreground transition-opacity duration-500 md:w-32",
                        !isHero && "opacity-0"
                    )}
                />
                <LogoSymbol
                    aria-hidden="true"
                    className={cn(
                        "absolute left-0 size-7 text-foreground transition-opacity duration-500 md:size-8",
                        isHero && "opacity-0"
                    )}
                />
            </Link>

            <div
                className={cn(
                    "flex items-center gap-1 rounded-[var(--radius-xl)] p-1 transition-[background-color,backdrop-filter] duration-500 md:gap-2 md:p-2",
                    isHero
                        ? "bg-transparent backdrop-blur-none"
                        : "bg-background/10 backdrop-blur-sm"
                )}
            >
                <ThemeSwitcher />
                <div className="h-4 w-px bg-border" />
                <Link to="/about" className="hidden sm:block">
                    <Button variant="ghost" size="sm">
                        About
                    </Button>
                </Link>
                <Link
                    to="/auth/$pathname"
                    params={{ pathname: "login" }}
                    search={{ redirect: PERSONA_ONBOARDING_PATH }}
                >
                    <Button size="sm" className="px-4 md:px-5">
                        Sign In
                    </Button>
                </Link>
            </div>
        </nav>
    )
}

export function PersonaLandingPage() {
    const scrollRef = useRef<HTMLDivElement>(null)
    // Same choreography as the root route's session splash: let the logo fill,
    // scale/fade it out, then mount the page so the hero entry animation starts
    // from a clean first frame.
    const [splashPhase, setSplashPhase] = useState<"filling" | "exiting" | "done">("filling")

    useEffect(() => {
        if (splashPhase === "done") return

        const timeoutId = window.setTimeout(
            () => setSplashPhase((phase) => (phase === "filling" ? "exiting" : "done")),
            splashPhase === "filling" ? SPLASH_FILL_DURATION_MS : SPLASH_EXIT_DURATION_MS
        )

        return () => window.clearTimeout(timeoutId)
    }, [splashPhase])

    if (splashPhase !== "done") {
        return <SplashScreen isExiting={splashPhase === "exiting"} label="Loading personas" />
    }

    return (
        <>
            <style>
                {`
                    .landing-page-root {
                        --landing-bg: var(--background);
                        --landing-fg: var(--foreground);
                        --landing-muted: color-mix(in oklab, var(--foreground) 68%, transparent);
                        --landing-muted-soft: color-mix(in oklab, var(--foreground) 54%, transparent);
                        --landing-muted-faint: color-mix(in oklab, var(--foreground) 40%, transparent);
                        --landing-border: color-mix(in oklab, var(--foreground) 12%, transparent);
                        --landing-border-strong: color-mix(in oklab, var(--foreground) 18%, transparent);
                        --landing-surface: color-mix(in oklab, var(--foreground) 2%, var(--background));
                        --landing-surface-strong: color-mix(in oklab, var(--foreground) 4%, var(--background));
                        --landing-surface-stronger: color-mix(in oklab, var(--foreground) 7%, var(--background));
                        --landing-surface-contrast: color-mix(in oklab, var(--foreground) 10%, var(--background));
                    }

                    .landing-page-scroll-root {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                        scrollbar-color: transparent transparent;
                        scroll-behavior: smooth;
                    }

                    .landing-page-scroll-root::-webkit-scrollbar {
                        width: 0 !important;
                        height: 0 !important;
                        display: none !important;
                        background: transparent !important;
                    }
                `}
            </style>
            <div
                ref={scrollRef}
                className="landing-page-root landing-page-scroll-root scrollbar-hide h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground"
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
                    style={{
                        backgroundImage: "url(/noise.png)",
                        backgroundRepeat: "repeat",
                        backgroundSize: "auto"
                    }}
                />

                <PersonaLandingNav containerRef={scrollRef} />

                <main>
                    <PersonaHeroSection />
                    <PersonaChatDemoSection />
                    <PersonaWalkthroughSection />
                    <PersonaValueSection />
                    <PricingSection />
                </main>

                <div className="relative overflow-hidden">
                    <SilkBackdrop silkClassName="opacity-45 dark:opacity-35" />
                    <PersonaCtaSection />
                    <FooterSection />
                </div>
            </div>
        </>
    )
}
