"use client"

import { ArrowRight } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { type ReactNode, useRef } from "react"

import { GithubIcon } from "@/components/brand-icons"
import { landingStats } from "@/components/landing-page/content"
import { FeatureArtCards } from "@/components/landing-page/feature-art-section"
import { PixelBackdrop } from "@/components/landing-page/pixel-backdrop"
import { SignInButton } from "@/components/landing-page/shared"
import { MagneticButton } from "@/components/magnetic-button"
import { Button } from "@/components/ui/button"

const rise = {
    hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
    shown: { opacity: 1, y: 0, filter: "blur(0px)" }
}

function Rise({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <motion.div
            variants={rise}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

export function HeroSection() {
    const reduced = useReducedMotion() === true
    const copyRef = useRef<HTMLDivElement>(null)
    const bandRef = useRef<HTMLDivElement>(null)

    return (
        <section
            id="hero"
            className="relative flex min-h-svh flex-col overflow-hidden px-5 pt-24 pb-8 text-center md:px-8"
        >
            <PixelBackdrop copyRef={copyRef} bandRef={bandRef} />

            <motion.div
                ref={copyRef}
                initial={reduced ? false : "hidden"}
                animate="shown"
                variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.12 } } }}
                className="relative mx-auto w-full max-w-3xl"
            >
                <Rise>
                    <h1 className="text-balance font-semibold text-5xl leading-[1.04] [color:var(--landing-fg)] md:text-7xl">
                        Every model.
                        <br />
                        One thread.
                    </h1>
                </Rise>

                <Rise>
                    <p className="mx-auto mt-6 max-w-xl text-balance text-lg [color:var(--landing-muted)]">
                        Move between GPT, Claude, Gemini, and dozens more without leaving the
                        conversation.
                    </p>
                </Rise>

                <Rise className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <MagneticButton>
                        <SignInButton className="gap-2 px-7">
                            Get started free
                            <ArrowRight className="size-4" />
                        </SignInButton>
                    </MagneticButton>
                    <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="h-12 gap-2 rounded-[var(--radius-lg)] px-7 font-semibold"
                    >
                        <a
                            href="https://github.com/medy17/silkchat"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <GithubIcon className="size-4" />
                            Star on GitHub
                        </a>
                    </Button>
                </Rise>

                <Rise>
                    <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-4 gap-x-3 md:mt-12 md:gap-x-6">
                        {landingStats.map(({ value, label }) => (
                            <div key={label} className="flex flex-col-reverse gap-1">
                                <dt className="text-xs [color:var(--landing-muted)]">{label}</dt>
                                <dd className="font-semibold text-2xl [color:var(--landing-fg)] md:text-4xl">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </Rise>
            </motion.div>

            <div ref={bandRef} aria-hidden="true" className="min-h-56 flex-1" />

            <FeatureArtCards />
        </section>
    )
}
