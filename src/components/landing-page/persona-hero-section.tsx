"use client"

import { useGSAP } from "@gsap/react"
import { Link } from "@tanstack/react-router"
import gsap from "gsap"
import { ArrowRight, MessagesSquare, ShieldCheck, Sparkles, VenetianMask } from "lucide-react"
import { useRef } from "react"

import { heroGenreCards, showcasePersonas } from "@/components/landing-page/persona-content"
import { RoleplayWordmark } from "@/components/logo"
import { Silk } from "@/components/react-bits/silk"
import { Button } from "@/components/ui/button"
import { useThemeStore } from "@/lib/theme-store"
import { cn } from "@/lib/utils"

const heroFeatures = [
    { Icon: VenetianMask, top: "Create", bottom: "your own" },
    { Icon: MessagesSquare, top: "Always", bottom: "in character" },
    { Icon: Sparkles, top: "Any model,", bottom: "any time" },
    { Icon: ShieldCheck, top: "Private", bottom: "& secure" }
]

export function PersonaHeroSection() {
    const { themeState } = useThemeStore()
    const heroRef = useRef<HTMLElement>(null)
    const isDarkMode = themeState.currentMode === "dark"
    const themeSilkColor =
        themeState.cssVars[themeState.currentMode]["muted-foreground"] || "#7B7481"
    const silkColor = isDarkMode ? "#9b969e" : themeSilkColor

    useGSAP(
        () => {
            const tl = gsap.timeline()
            tl.fromTo(
                ".persona-hero-logo",
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
                    ".persona-hero-subtitle",
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
                    ".persona-hero-cta",
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
                    ".persona-hero-feature",
                    { y: 20, opacity: 0, scale: 0.5 },
                    {
                        y: 0,
                        opacity: 1,
                        scale: 1,
                        duration: 0.8,
                        stagger: 0.1,
                        ease: "back.out(1.5)",
                        clearProps: "willChange"
                    },
                    "-=1.2"
                )
                // The row animates as a single unit: the cards carry a skewX
                // transform from a class, and GSAP's y tween would overwrite it
                // with an inline transform if the cards animated individually.
                // clearProps "all": a leftover identity transform on the row
                // keeps a compositing layer alive and Chrome stops repainting
                // the cards' hover scale until a click forces it.
                .fromTo(
                    ".persona-hero-genres",
                    { y: 60, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 1.2,
                        ease: "power3.out",
                        clearProps: "all"
                    },
                    "-=1.4"
                )
                .fromTo(
                    ".persona-hero-social-proof",
                    { y: 20, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.8,
                        ease: "power3.out",
                        clearProps: "willChange"
                    },
                    "-=0.8"
                )
        },
        { scope: heroRef }
    )

    return (
        <section
            id="persona-hero"
            ref={heroRef}
            className="relative flex min-h-svh flex-col justify-center overflow-hidden px-5 pt-28 pb-16 md:px-8"
        >
            <div className="pointer-events-none absolute inset-0 z-0">
                <Silk
                    className="h-full w-full opacity-70 dark:opacity-55"
                    color={silkColor}
                    contrast={isDarkMode ? 1 : 1.06}
                    noiseIntensity={isDarkMode ? 1.5 : 0.35}
                    rotation={0}
                    scale={isDarkMode ? 1 : 0.92}
                    speed={3.4}
                />
                <div className="absolute inset-0 bg-background/50" />
            </div>

            <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center text-center">
                <h1
                    className="persona-hero-logo mx-auto flex w-full max-w-[min(80vw,28rem)] items-center justify-center [color:var(--landing-fg)]"
                    style={{ willChange: "transform, opacity" }}
                >
                    <span className="sr-only">Roleplay Your Way</span>
                    <RoleplayWordmark className="h-auto w-full" />
                </h1>

                <p
                    className="persona-hero-subtitle mx-auto mt-7 max-w-2xl text-balance text-lg [color:var(--landing-muted)] md:text-xl"
                    style={{ willChange: "transform, opacity" }}
                >
                    Engage in immersive AI persona roleplay chats with dynamic characters and
                    endless thrilling stories.
                </p>

                <div
                    className="persona-hero-cta mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
                    style={{ willChange: "transform, opacity" }}
                >
                    <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                        <Button
                            size="lg"
                            className="h-14 gap-2 px-8 font-semibold text-lg shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                        >
                            Start chatting free
                            <ArrowRight className="size-5" />
                        </Button>
                    </Link>
                </div>

                {/* Anchored to the genre band below: same w-full max-w-6xl px-8
                    frame, split into four equal columns so each feature sits over
                    its quarter of the image grid. The outer two items pin to the
                    frame edges so the row spans exactly as wide as the band. */}
                {/* Optical nudge: the genre cards below are skewed, so the band's
                    top edge — what the eye aligns this row against — sits ~19px
                    right of the frame on mobile (h/2 · tan 7°). Shift right by
                    roughly half that to split the difference; at sm+ the wider
                    frame absorbs the illusion. */}
                <div className="mt-12 grid w-full max-w-6xl translate-x-2.5 grid-cols-4 px-8 sm:translate-x-0">
                    {heroFeatures.map(({ Icon, top, bottom }, index) => (
                        <div
                            key={top}
                            className={cn(
                                "persona-hero-feature flex flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2.5 sm:text-left sm:[border-color:var(--landing-border)] sm:[&:not(:first-child)]:border-l",
                                index === 0 && "sm:justify-start",
                                index === heroFeatures.length - 1 && "sm:justify-end",
                                index !== 0 &&
                                    index !== heroFeatures.length - 1 &&
                                    "sm:justify-center"
                            )}
                            style={{ willChange: "transform, opacity" }}
                        >
                            <Icon className="size-4 shrink-0 [color:var(--landing-muted-soft)] sm:size-5" />
                            <span className="text-[11px] leading-tight [color:var(--landing-muted)] sm:text-sm">
                                {top}
                                <br />
                                {bottom}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Genre slit row — band of slanted parallelogram cards, constrained to the
                same max width as the rest of the hero. The card frame is skewed while the
                image sits in a counter-skewed wrapper so the photo stays upright. The
                wrapper bleeds horizontally by a fixed 3rem: at skewX(7deg) the frame's
                corners shift by (h/2)·tan(7°) ≈ 28px for the tallest (28rem) card, so
                3rem covers the sheared corners at every breakpoint without resorting to
                width-relative (and thus unreliable) percentage insets. The row's px-8
                gives the outer cards' slants room so they aren't clipped flat. */}
            <div
                className="persona-hero-genres relative z-10 mx-auto mt-16 flex w-full max-w-6xl justify-center gap-2 px-8 sm:gap-3"
                style={{ willChange: "transform, opacity" }}
            >
                {heroGenreCards.map((card, index) => (
                    <Link
                        key={card.genre}
                        to="/auth/$pathname"
                        params={{ pathname: "login" }}
                        className={cn(
                            "group relative h-[19rem] min-w-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border shadow-2xl transition-all duration-300 [border-color:var(--landing-border)] [transform:skewX(-7deg)] hover:z-10 sm:h-[24rem] lg:h-[28rem]",
                            // Shed trailing slots as the band narrows: 3 cards on
                            // mobile, 4 from sm, all 5 from lg.
                            index === 3 && "hidden sm:block",
                            index === 4 && "hidden lg:block"
                        )}
                    >
                        <div className="-left-12 -right-12 absolute inset-y-0 [transform:skewX(7deg)]">
                            <img
                                src={card.imagePath}
                                alt={card.genre}
                                loading="lazy"
                                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 opacity-100 transition-opacity duration-500 ease-out group-hover:opacity-60" />
                        <div className="absolute inset-x-0 bottom-0 hidden p-3 text-center [transform:skewX(7deg)] sm:block">
                            <p className="font-semibold text-sm text-white leading-tight tracking-tight lg:text-base">
                                {card.genre}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Social proof */}
            <div
                className="persona-hero-social-proof relative z-10 mx-auto mt-14 flex flex-col items-center gap-3"
                style={{ willChange: "transform, opacity" }}
            >
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                    <ul className="-space-x-2.5 flex shrink-0">
                        {showcasePersonas.map((persona) => (
                            <li key={persona.id} className="shrink-0">
                                <img
                                    src={persona.avatarPath}
                                    alt=""
                                    loading="lazy"
                                    className="size-8 shrink-0 rounded-full border-2 object-cover [border-color:var(--landing-bg)]"
                                />
                            </li>
                        ))}
                    </ul>
                    <span className="text-center text-sm [color:var(--landing-muted)] sm:text-left">
                        Twelve built-in personas — and unlimited of your own.
                    </span>
                </div>
            </div>
        </section>
    )
}
