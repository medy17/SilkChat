"use client"

import { motion, useReducedMotion } from "motion/react"

import { SHURIKEN_BUBBLE_DURATION_MS, ShurikenBubble } from "@/components/shuriken-bubble"

// Finish drawing the bubble and hold briefly before the zoom/fade transition.
export const SPLASH_REVEAL_DURATION_MS = SHURIKEN_BUBBLE_DURATION_MS + 500
export const SPLASH_EXIT_DURATION_MS = 700

export function SplashScreen({
    isExiting,
    label = "Loading"
}: {
    isExiting: boolean
    label?: string
}) {
    const reduceMotion = useReducedMotion()

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
                    scale: isExiting && !reduceMotion ? 4.5 : 1
                }}
                className="relative size-24"
                initial={false}
                transition={{
                    duration: SPLASH_EXIT_DURATION_MS / 1000,
                    ease: [0.16, 1, 0.3, 1]
                }}
            >
                <ShurikenBubble
                    animated={reduceMotion === false}
                    aria-hidden="true"
                    className="size-full text-primary"
                />
                <span className="sr-only">{label}</span>
            </motion.div>
        </motion.div>
    )
}
