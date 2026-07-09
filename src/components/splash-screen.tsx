"use client"

import { motion } from "motion/react"

import { LogoSymbol } from "@/components/logo"

// Keep in sync with the `root-logo-fill` keyframes in styles/custom.css.
export const SPLASH_FILL_DURATION_MS = 2000
export const SPLASH_EXIT_DURATION_MS = 700

export function SplashScreen({
    isExiting,
    label = "Loading"
}: {
    isExiting: boolean
    label?: string
}) {
    return (
        <motion.div
            animate={{
                opacity: isExiting ? 0 : 1
            }}
            aria-busy="true"
            aria-label={label}
            className="flex min-h-svh items-center justify-center overflow-hidden bg-background"
            initial={false}
            transition={{
                duration: SPLASH_EXIT_DURATION_MS / 1000,
                ease: [0.16, 1, 0.3, 1]
            }}
        >
            <motion.div
                animate={{
                    scale: isExiting ? 4.5 : 1
                }}
                className="relative size-24"
                initial={false}
                transition={{
                    duration: SPLASH_EXIT_DURATION_MS / 1000,
                    ease: [0.16, 1, 0.3, 1]
                }}
            >
                <LogoSymbol className="absolute inset-0 size-full text-muted-foreground/20" />
                <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0 animate-[root-logo-fill_2s_ease-in-out_forwards] overflow-hidden"
                >
                    <LogoSymbol className="absolute bottom-0 left-0 size-24 text-primary" />
                </div>
                <span className="sr-only">{label}</span>
            </motion.div>
        </motion.div>
    )
}
