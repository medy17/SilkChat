"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useRef } from "react"

gsap.registerPlugin(ScrollTrigger)

export function ShowcaseSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".showcase-header",
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
                ".showcase-item",
                { y: 50, opacity: 0, scale: 0.98 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 1.2,
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
            id="showcase"
            ref={sectionRef}
            className="flex min-h-[150vh] snap-start flex-col items-center justify-center bg-muted/10 px-4 py-20 md:min-h-screen md:px-8 lg:min-h-[120vh]"
        >
            <div className="mx-auto w-full max-w-[1400px]">
                <div
                    className="showcase-header mb-12 text-center"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">
                        Experience the Interface
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        A beautifully crafted workspace for all your AI interactions.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-16 pb-10 lg:grid-cols-2 lg:gap-12">
                    <div
                        className="showcase-item flex snap-center flex-col gap-4 md:snap-align-none"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <h3 className="px-2 text-center font-semibold text-2xl lg:text-left">
                            Chat Experience
                        </h3>
                        <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted/30 shadow-2xl">
                            <img
                                src="/screenshots/desktop/chat-desktop-light.png"
                                alt="Chat Desktop Light"
                                className="hidden h-auto w-full bg-background object-contain md:block dark:md:hidden"
                            />
                            <img
                                src="/screenshots/desktop/chat-desktop-dark.png"
                                alt="Chat Desktop Dark"
                                className="hidden h-auto w-full bg-background object-contain md:dark:block"
                            />
                            <img
                                src="/screenshots/mobile/chat-mobile-light.png"
                                alt="Chat Mobile Light"
                                className="block h-auto w-full bg-background object-contain md:hidden dark:hidden"
                            />
                            <img
                                src="/screenshots/mobile/chat-mobile-dark.png"
                                alt="Chat Mobile Dark"
                                className="hidden h-auto w-full bg-background object-contain dark:block dark:md:hidden"
                            />
                        </div>
                    </div>

                    <div
                        className="showcase-item flex snap-center flex-col gap-4 pt-8 md:snap-align-none lg:pt-0"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <h3 className="px-2 text-center font-semibold text-2xl lg:text-left">
                            Library & Artifacts
                        </h3>
                        <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted/30 shadow-2xl">
                            <img
                                src="/screenshots/desktop/library-desktop-light.png"
                                alt="Library Desktop Light"
                                className="hidden h-auto w-full bg-background object-contain md:block dark:md:hidden"
                            />
                            <img
                                src="/screenshots/desktop/library-desktop-dark.png"
                                alt="Library Desktop Dark"
                                className="hidden h-auto w-full bg-background object-contain md:dark:block"
                            />
                            <img
                                src="/screenshots/mobile/library-mobile-light.png"
                                alt="Library Mobile Light"
                                className="block h-auto w-full bg-background object-contain md:hidden dark:hidden"
                            />
                            <img
                                src="/screenshots/mobile/library-mobile-dark.png"
                                alt="Library Mobile Dark"
                                className="hidden h-auto w-full bg-background object-contain dark:block dark:md:hidden"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
