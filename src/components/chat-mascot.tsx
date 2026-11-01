import type { FamiliarMood } from "@/lib/familiar-mood-store"
import { cn } from "@/lib/utils"
import { type SVGProps, useEffect, useId, useRef, useState } from "react"

type ChatMascotProps = SVGProps<SVGSVGElement> & {
    mood?: FamiliarMood
    variant?: "full" | "face"
    // Clicking makes it happy; clicking it a lot makes it dizzy.
    pokeable?: boolean
}

const POKE_MS = 900
// 0.3s of bonk, then the 1.8s orbit
const DIZZY_MS = 2100
const DIZZY_POKES = 5
const DIZZY_WINDOW_MS = 2500

// Animations hold still while the tab isn't focused, so a forgotten tab costs nothing.
const useTabFocused = () => {
    const [isFocused, setIsFocused] = useState(true)

    useEffect(() => {
        const update = () =>
            setIsFocused(document.visibilityState === "visible" && document.hasFocus())
        update()
        window.addEventListener("focus", update)
        window.addEventListener("blur", update)
        document.addEventListener("visibilitychange", update)
        return () => {
            window.removeEventListener("focus", update)
            window.removeEventListener("blur", update)
            document.removeEventListener("visibilitychange", update)
        }
    }, [])

    return isFocused
}

const usePokeMood = () => {
    const [pokeMood, setPokeMood] = useState<FamiliarMood | null>(null)
    const pokes = useRef<number[]>([])
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current)
        },
        []
    )

    const poke = () => {
        const now = Date.now()
        pokes.current = [...pokes.current.filter((at) => now - at < DIZZY_WINDOW_MS), now]
        const isDizzy = pokes.current.length >= DIZZY_POKES
        if (isDizzy) pokes.current = []
        if (timer.current) clearTimeout(timer.current)
        setPokeMood(isDizzy ? "dizzy" : "happy")
        timer.current = setTimeout(() => setPokeMood(null), isDizzy ? DIZZY_MS : POKE_MS)
    }

    return { pokeMood, poke }
}

const mascotColors = {
    hoodHighlight: "var(--secondary)",
    hoodMidtone: "var(--accent)",
    hoodShadow: "color-mix(in oklch, var(--muted-foreground) 76%, var(--primary))",
    cloakHighlight: "var(--primary)",
    cloakMidtone: "var(--muted-foreground)",
    cloakShadow: "color-mix(in oklch, var(--muted-foreground) 60%, var(--background))",
    faceHighlight: "color-mix(in oklch, var(--foreground) 88%, var(--muted-foreground))",
    faceShadow: "var(--foreground)",
    featureLight: "var(--background)",
    featureDark: "var(--foreground)",
    accentLight: "color-mix(in oklch, var(--background) 70%, var(--muted-foreground))",
    accentMidtone: "var(--accent)",
    runeHighlight: "var(--primary)",
    runeShadow: "var(--muted-foreground)",
    shadow: "var(--muted-foreground)"
} as const

export function ChatMascot({
    className,
    mood = "idle",
    variant = "full",
    pokeable = false,
    ...props
}: ChatMascotProps) {
    const instanceId = useId().replaceAll(":", "")
    const id = (name: string) => `${name}-${instanceId}`
    const { pokeMood, poke } = usePokeMood()
    const isTabFocused = useTabFocused()

    const svg = (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={variant === "face" ? "285 150 585 610" : "0 0 1024 1024"}
            role="img"
            aria-labelledby={`${id("title")} ${id("description")}`}
            data-mood={pokeMood ?? mood}
            data-paused={isTabFocused ? undefined : ""}
            className={cn(
                variant === "face" ? "chat-mascot-face overflow-hidden" : "overflow-visible",
                pokeable ? "size-full" : className
            )}
            {...props}
        >
            <title id={id("title")}>SilkChat floating familiar mascot</title>
            <desc id={id("description")}>
                A lavender hooded floating spirit with a dark expressive face, a purple cloak, and
                an orbiting rune.
            </desc>

            <defs>
                <linearGradient id={id("hood-gradient")} x1="0.18" y1="0.05" x2="0.82" y2="0.96">
                    <stop offset="0" stopColor={mascotColors.hoodHighlight} />
                    <stop offset="0.52" stopColor={mascotColors.hoodMidtone} />
                    <stop offset="1" stopColor={mascotColors.hoodShadow} />
                </linearGradient>
                <linearGradient id={id("cloak-gradient")} x1="0.1" y1="0.1" x2="0.92" y2="0.92">
                    <stop offset="0" stopColor={mascotColors.cloakHighlight} />
                    <stop offset="0.58" stopColor={mascotColors.cloakMidtone} />
                    <stop offset="1" stopColor={mascotColors.cloakShadow} />
                </linearGradient>
                <linearGradient id={id("face-gradient")} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={mascotColors.faceHighlight} />
                    <stop offset="1" stopColor={mascotColors.faceShadow} />
                </linearGradient>
                <linearGradient id={id("rune-gradient")} x1="0.2" y1="0.1" x2="0.85" y2="0.95">
                    <stop offset="0" stopColor={mascotColors.runeHighlight} />
                    <stop offset="1" stopColor={mascotColors.runeShadow} />
                </linearGradient>
                <radialGradient id={id("shadow-gradient")} cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor={mascotColors.shadow} stopOpacity="0.22" />
                    <stop offset="1" stopColor={mascotColors.shadow} stopOpacity="0" />
                </radialGradient>
                <filter id={id("soft-shadow")} x="-20%" y="-30%" width="140%" height="160%">
                    <feGaussianBlur stdDeviation="10" />
                </filter>
                <style>{`
                    .chat-mascot-body, .chat-mascot-rune, .chat-mascot-rune-back, .chat-mascot-cloak,
                    .chat-mascot-head, .chat-mascot-eye, .chat-mascot-pupil,
                    .chat-mascot-brow, .chat-mascot-brow-glint {
                        transform-box: fill-box;
                        transform-origin: center;
                    }

                    .chat-mascot-brow-glint,
                    .chat-mascot-mood-feature,
                    .chat-mascot-rune-back,
                    .chat-mascot-star,
                    .chat-mascot-bonk {
                        opacity: 0;
                    }
                    .chat-mascot-bonk {
                        transform-box: fill-box;
                        transform-origin: 50% 100%;
                    }
                    .chat-mascot-star {
                        transform-box: fill-box;
                        transform-origin: center;
                    }

                    [data-mood="happy"] .chat-mascot-eye,
                    [data-mood="sleepy"] .chat-mascot-eye,
                    [data-mood="happy"] .chat-mascot-mouth-smile,
                    [data-mood="surprised"] .chat-mascot-mouth-smile,
                    [data-mood="worried"] .chat-mascot-mouth-smile,
                    [data-mood="sleepy"] .chat-mascot-mouth-smile,
                    [data-mood="dizzy"] .chat-mascot-mouth-smile,
                    [data-mood="dizzy"] .chat-mascot-pupil {
                        opacity: 0;
                    }
                    [data-mood="happy"] .chat-mascot-happy-eye,
                    [data-mood="happy"] .chat-mascot-mouth-grin,
                    [data-mood="surprised"] .chat-mascot-mouth-o,
                    [data-mood="surprised"] .chat-mascot-brow-glint,
                    [data-mood="worried"] .chat-mascot-mouth-wavy,
                    [data-mood="dizzy"] .chat-mascot-mouth-wavy,
                    [data-mood="dizzy"] .chat-mascot-spiral,
                    [data-mood="sleepy"] .chat-mascot-mouth-flat,
                    [data-mood="sleepy"] .chat-mascot-sleepy-eye,
                    [data-mood="sleepy"] .chat-mascot-zzz,
                    [data-mood="listening"] .chat-mascot-wave-1,
                    [data-mood="worried"] .chat-mascot-sweat {
                        opacity: 1;
                    }
                    .chat-mascot-wave-1 { --wave-rest: 1; }
                    .chat-mascot-wave-2 { --wave-rest: 0.7; transition-delay: 90ms; }
                    .chat-mascot-wave-3 { --wave-rest: 0.45; transition-delay: 180ms; }
                    [data-mood="listening"] .chat-mascot-wave-2,
                    [data-mood="listening"] .chat-mascot-wave-3 {
                        opacity: var(--wave-rest);
                    }
                    [data-mood="sleepy"] .chat-mascot-zzz-2 {
                        transition-delay: 120ms;
                    }
                    [data-mood="sleepy"] .chat-mascot-zzz-3 {
                        transition-delay: 240ms;
                    }

                    [data-mood="happy"] .chat-mascot-brow {
                        transform: translateY(-8px);
                    }

                    [data-mood="surprised"] .chat-mascot-eye {
                        transform: scale(1.12);
                    }
                    [data-mood="surprised"] .chat-mascot-pupil {
                        transform: scale(0.72);
                    }
                    [data-mood="surprised"] .chat-mascot-brow {
                        transform: translateY(-16px);
                    }

                    [data-mood="listening"] .chat-mascot-head {
                        transform: translateY(6px) rotate(-7deg);
                    }
                    [data-mood="listening"] .chat-mascot-pupil {
                        transform: translate(6px, -10px);
                    }
                    [data-mood="listening"] .chat-mascot-brow {
                        transform: translateY(-6px);
                    }

                    [data-mood="worried"] .chat-mascot-brow-left {
                        transform: translateY(-8px) rotate(-18deg);
                    }
                    [data-mood="worried"] .chat-mascot-brow-right {
                        transform: translateY(-8px) rotate(18deg);
                    }
                    [data-mood="worried"] .chat-mascot-pupil {
                        transform: translateY(4px) scale(0.78);
                    }

                    [data-mood="sleepy"] .chat-mascot-brow {
                        transform: translateY(6px);
                    }
                    [data-mood="sleepy"] .chat-mascot-rune {
                        opacity: 0.55;
                    }

                    [data-mood="dizzy"] .chat-mascot-head {
                        transform: rotate(-5deg);
                    }

                    .chat-mascot-face .chat-mascot-cloak,
                    .chat-mascot-face .chat-mascot-rune,
                    .chat-mascot-face .chat-mascot-rune-back,
                    .chat-mascot-face .chat-mascot-star,
                    .chat-mascot-face .chat-mascot-shadow {
                        display: none;
                    }

                    [data-mood="curious"] .chat-mascot-head {
                        transform: translateY(14px) rotate(6deg);
                    }

                    [data-mood="curious"] .chat-mascot-pupil-left {
                        transform: translate(9px, 16px) scale(0.78);
                    }

                    [data-mood="curious"] .chat-mascot-pupil-right {
                        transform: translate(-9px, 16px) scale(0.78);
                    }

                    [data-mood="curious"] .chat-mascot-brow-right {
                        transform: translateY(-18px) rotate(-8deg);
                        stroke-width: 13px;
                    }

                    @media (prefers-reduced-motion: no-preference) {
                        .chat-mascot-body { animation: chat-mascot-float 4.2s ease-in-out infinite; }
                        .chat-mascot-rune { animation: chat-mascot-rune-bob 3.4s ease-in-out infinite; }
                        .chat-mascot-cloak { animation: chat-mascot-cloak-sway 4.2s ease-in-out infinite; }
                        .chat-mascot-eye { animation: chat-mascot-blink 6.8s ease-in-out infinite; }
                        /* Moods that reshape the eyes hold still instead of blinking over it. */
                        [data-mood="surprised"] .chat-mascot-eye,
                        [data-mood="sleepy"] .chat-mascot-eye {
                            animation: none;
                        }
                        .chat-mascot-eye, .chat-mascot-mood-feature, .chat-mascot-mouth-smile,
                        .chat-mascot-rune {
                            transition:
                                transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
                                opacity 160ms ease-out;
                        }
                        .chat-mascot-head, .chat-mascot-pupil, .chat-mascot-brow {
                            transition:
                                transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
                                stroke-width 240ms cubic-bezier(0.16, 1, 0.3, 1),
                                opacity 160ms ease-out;
                        }
                        [data-mood="curious"] .chat-mascot-brow-glint {
                            animation: chat-mascot-brow-glint 3.8s ease-in-out 600ms infinite;
                        }

                        /* Mood loops spend most of each cycle resting. */
                        [data-mood="sleepy"] .chat-mascot-zzz {
                            animation: chat-mascot-zzz-drift 20s ease-in-out infinite;
                        }
                        [data-mood="sleepy"] .chat-mascot-zzz-2 { animation-delay: 350ms; }
                        [data-mood="sleepy"] .chat-mascot-zzz-3 { animation-delay: 700ms; }

                        [data-mood="listening"] [class*="chat-mascot-wave"] {
                            animation: chat-mascot-wave-ripple 6s ease-out infinite;
                        }
                        [data-mood="listening"] .chat-mascot-wave-2 { animation-delay: 150ms; }
                        [data-mood="listening"] .chat-mascot-wave-3 { animation-delay: 300ms; }

                        /* The fifth poke lands as a bonk: a held squash, a spring back, and a
                           burst off the top of the hood. The orbit waits for it. */
                        [data-mood="dizzy"] .chat-mascot-body {
                            transform-origin: 50% 100%;
                            animation: chat-mascot-bonk 650ms linear 1;
                        }
                        [data-mood="dizzy"] .chat-mascot-bonk {
                            animation: chat-mascot-bonk-burst 380ms ease-out 1;
                        }

                        /* Two laps on a flat ellipse around the head, matching the 1.8s dizzy
                           spell, quicker across the front. A second copy drawn before the head
                           takes over for the back half so the hood really hides it; they swap
                           at the ends of the ellipse, beside the head. */
                        [data-mood="dizzy"] .chat-mascot-rune {
                            animation: chat-mascot-rune-orbit-front 1.8s linear 300ms 1;
                        }
                        [data-mood="dizzy"] .chat-mascot-rune-back {
                            animation: chat-mascot-rune-orbit-back 1.8s linear 300ms 1;
                        }
                        /* Two stars share the rock's ellipse, a third and two thirds of a lap
                           ahead, and pop in and out instead of gliding from the rock. */
                        [data-mood="dizzy"] .chat-mascot-star-1 {
                            animation: chat-mascot-star-1-front 1.8s linear 300ms 1;
                        }
                        [data-mood="dizzy"] .chat-mascot-star-1-back {
                            animation: chat-mascot-star-1-back 1.8s linear 300ms 1;
                        }
                        [data-mood="dizzy"] .chat-mascot-star-2 {
                            animation: chat-mascot-star-2-front 1.8s linear 300ms 1;
                        }
                        [data-mood="dizzy"] .chat-mascot-star-2-back {
                            animation: chat-mascot-star-2-back 1.8s linear 300ms 1;
                        }
                    }

                    [data-paused] *, [data-paused] {
                        animation-play-state: paused !important;
                    }

                    @keyframes chat-mascot-zzz-drift {
                        0%, 60% { opacity: 1; transform: translate(0, 0); }
                        70% { opacity: 0; transform: translate(14px, -34px); }
                        70.01% { opacity: 0; transform: translate(0, 0); }
                        78%, 100% { opacity: 1; transform: translate(0, 0); }
                    }

                    @keyframes chat-mascot-wave-ripple {
                        0%, 30%, 100% { opacity: var(--wave-rest); transform: translateX(0); }
                        8% { opacity: 1; transform: translateX(-10px); }
                        18% { opacity: 0.2; transform: translateX(-16px); }
                    }

                    @keyframes chat-mascot-star-1-front {
                        0.00% { opacity: 1; transform: translate(400px, 481px) scale(0); }
                        6.00% { opacity: 1; transform: translate(400px, 481px) scale(0.987); }
                        7.34% { opacity: 1; transform: translate(338px, 469px) scale(0.971); }
                        8.76% { opacity: 1; transform: translate(290px, 455px) scale(0.95); }
                        10.27% { opacity: 1; transform: translate(260px, 438px) scale(0.926); }
                        11.92% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        11.93% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        13.72% { opacity: 0; transform: translate(260px, 402px) scale(0.874); }
                        15.70% { opacity: 0; transform: translate(290px, 385px) scale(0.85); }
                        17.88% { opacity: 0; transform: translate(338px, 371px) scale(0.829); }
                        20.26% { opacity: 0; transform: translate(400px, 359px) scale(0.813); }
                        22.80% { opacity: 0; transform: translate(472px, 352px) scale(0.803); }
                        25.43% { opacity: 0; transform: translate(550px, 350px) scale(0.8); }
                        28.06% { opacity: 0; transform: translate(628px, 352px) scale(0.803); }
                        30.60% { opacity: 0; transform: translate(700px, 359px) scale(0.813); }
                        32.97% { opacity: 0; transform: translate(762px, 371px) scale(0.829); }
                        35.16% { opacity: 0; transform: translate(810px, 385px) scale(0.85); }
                        37.14% { opacity: 0; transform: translate(840px, 402px) scale(0.874); }
                        38.94% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        38.95% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        40.58% { opacity: 1; transform: translate(840px, 438px) scale(0.926); }
                        42.09% { opacity: 1; transform: translate(810px, 455px) scale(0.95); }
                        43.51% { opacity: 1; transform: translate(762px, 469px) scale(0.971); }
                        44.85% { opacity: 1; transform: translate(700px, 481px) scale(0.987); }
                        46.15% { opacity: 1; transform: translate(628px, 488px) scale(0.997); }
                        47.43% { opacity: 1; transform: translate(550px, 490px) scale(1.0); }
                        48.70% { opacity: 1; transform: translate(472px, 488px) scale(0.997); }
                        50.00% { opacity: 1; transform: translate(400px, 481px) scale(0.987); }
                        51.34% { opacity: 1; transform: translate(338px, 469px) scale(0.971); }
                        52.76% { opacity: 1; transform: translate(290px, 455px) scale(0.95); }
                        54.27% { opacity: 1; transform: translate(260px, 438px) scale(0.926); }
                        55.92% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        55.93% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        57.72% { opacity: 0; transform: translate(260px, 402px) scale(0.874); }
                        59.70% { opacity: 0; transform: translate(290px, 385px) scale(0.85); }
                        61.88% { opacity: 0; transform: translate(338px, 371px) scale(0.829); }
                        64.26% { opacity: 0; transform: translate(400px, 359px) scale(0.813); }
                        66.80% { opacity: 0; transform: translate(472px, 352px) scale(0.803); }
                        69.43% { opacity: 0; transform: translate(550px, 350px) scale(0.8); }
                        72.06% { opacity: 0; transform: translate(628px, 352px) scale(0.803); }
                        74.60% { opacity: 0; transform: translate(700px, 359px) scale(0.813); }
                        76.97% { opacity: 0; transform: translate(762px, 371px) scale(0.829); }
                        79.16% { opacity: 0; transform: translate(810px, 385px) scale(0.85); }
                        81.14% { opacity: 0; transform: translate(840px, 402px) scale(0.874); }
                        82.94% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        82.95% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        84.58% { opacity: 1; transform: translate(840px, 438px) scale(0.926); }
                        86.09% { opacity: 1; transform: translate(810px, 455px) scale(0.95); }
                        87.51% { opacity: 1; transform: translate(762px, 469px) scale(0.971); }
                        88.85% { opacity: 1; transform: translate(700px, 481px) scale(0.987); }
                        90.15% { opacity: 1; transform: translate(628px, 488px) scale(0.997); }
                        91.43% { opacity: 1; transform: translate(550px, 490px) scale(1.0); }
                        92.70% { opacity: 1; transform: translate(472px, 488px) scale(0.997); }
                        94.00% { opacity: 1; transform: translate(400px, 481px) scale(0.987); }
                        100.00% { opacity: 1; transform: translate(400px, 481px) scale(0); }
                    }

                    @keyframes chat-mascot-star-1-back {
                        0.00% { opacity: 0; transform: translate(400px, 481px) scale(0); }
                        6.00% { opacity: 0; transform: translate(400px, 481px) scale(0.987); }
                        7.34% { opacity: 0; transform: translate(338px, 469px) scale(0.971); }
                        8.76% { opacity: 0; transform: translate(290px, 455px) scale(0.95); }
                        10.27% { opacity: 0; transform: translate(260px, 438px) scale(0.926); }
                        11.92% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        11.93% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        13.72% { opacity: 1; transform: translate(260px, 402px) scale(0.874); }
                        15.70% { opacity: 1; transform: translate(290px, 385px) scale(0.85); }
                        17.88% { opacity: 1; transform: translate(338px, 371px) scale(0.829); }
                        20.26% { opacity: 1; transform: translate(400px, 359px) scale(0.813); }
                        22.80% { opacity: 1; transform: translate(472px, 352px) scale(0.803); }
                        25.43% { opacity: 1; transform: translate(550px, 350px) scale(0.8); }
                        28.06% { opacity: 1; transform: translate(628px, 352px) scale(0.803); }
                        30.60% { opacity: 1; transform: translate(700px, 359px) scale(0.813); }
                        32.97% { opacity: 1; transform: translate(762px, 371px) scale(0.829); }
                        35.16% { opacity: 1; transform: translate(810px, 385px) scale(0.85); }
                        37.14% { opacity: 1; transform: translate(840px, 402px) scale(0.874); }
                        38.94% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        38.95% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        40.58% { opacity: 0; transform: translate(840px, 438px) scale(0.926); }
                        42.09% { opacity: 0; transform: translate(810px, 455px) scale(0.95); }
                        43.51% { opacity: 0; transform: translate(762px, 469px) scale(0.971); }
                        44.85% { opacity: 0; transform: translate(700px, 481px) scale(0.987); }
                        46.15% { opacity: 0; transform: translate(628px, 488px) scale(0.997); }
                        47.43% { opacity: 0; transform: translate(550px, 490px) scale(1.0); }
                        48.70% { opacity: 0; transform: translate(472px, 488px) scale(0.997); }
                        50.00% { opacity: 0; transform: translate(400px, 481px) scale(0.987); }
                        51.34% { opacity: 0; transform: translate(338px, 469px) scale(0.971); }
                        52.76% { opacity: 0; transform: translate(290px, 455px) scale(0.95); }
                        54.27% { opacity: 0; transform: translate(260px, 438px) scale(0.926); }
                        55.92% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        55.93% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        57.72% { opacity: 1; transform: translate(260px, 402px) scale(0.874); }
                        59.70% { opacity: 1; transform: translate(290px, 385px) scale(0.85); }
                        61.88% { opacity: 1; transform: translate(338px, 371px) scale(0.829); }
                        64.26% { opacity: 1; transform: translate(400px, 359px) scale(0.813); }
                        66.80% { opacity: 1; transform: translate(472px, 352px) scale(0.803); }
                        69.43% { opacity: 1; transform: translate(550px, 350px) scale(0.8); }
                        72.06% { opacity: 1; transform: translate(628px, 352px) scale(0.803); }
                        74.60% { opacity: 1; transform: translate(700px, 359px) scale(0.813); }
                        76.97% { opacity: 1; transform: translate(762px, 371px) scale(0.829); }
                        79.16% { opacity: 1; transform: translate(810px, 385px) scale(0.85); }
                        81.14% { opacity: 1; transform: translate(840px, 402px) scale(0.874); }
                        82.94% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        82.95% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        84.58% { opacity: 0; transform: translate(840px, 438px) scale(0.926); }
                        86.09% { opacity: 0; transform: translate(810px, 455px) scale(0.95); }
                        87.51% { opacity: 0; transform: translate(762px, 469px) scale(0.971); }
                        88.85% { opacity: 0; transform: translate(700px, 481px) scale(0.987); }
                        90.15% { opacity: 0; transform: translate(628px, 488px) scale(0.997); }
                        91.43% { opacity: 0; transform: translate(550px, 490px) scale(1.0); }
                        92.70% { opacity: 0; transform: translate(472px, 488px) scale(0.997); }
                        94.00% { opacity: 0; transform: translate(400px, 481px) scale(0.987); }
                        100.00% { opacity: 0; transform: translate(400px, 481px) scale(0); }
                    }

                    @keyframes chat-mascot-star-2-front {
                        0.00% { opacity: 0; transform: translate(400px, 359px) scale(0); }
                        6.00% { opacity: 0; transform: translate(400px, 359px) scale(0.813); }
                        8.54% { opacity: 0; transform: translate(472px, 352px) scale(0.803); }
                        11.17% { opacity: 0; transform: translate(550px, 350px) scale(0.8); }
                        13.80% { opacity: 0; transform: translate(628px, 352px) scale(0.803); }
                        16.34% { opacity: 0; transform: translate(700px, 359px) scale(0.813); }
                        18.71% { opacity: 0; transform: translate(762px, 371px) scale(0.829); }
                        20.90% { opacity: 0; transform: translate(810px, 385px) scale(0.85); }
                        22.88% { opacity: 0; transform: translate(840px, 402px) scale(0.874); }
                        24.68% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        24.69% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        26.32% { opacity: 1; transform: translate(840px, 438px) scale(0.926); }
                        27.84% { opacity: 1; transform: translate(810px, 455px) scale(0.95); }
                        29.25% { opacity: 1; transform: translate(762px, 469px) scale(0.971); }
                        30.60% { opacity: 1; transform: translate(700px, 481px) scale(0.987); }
                        31.89% { opacity: 1; transform: translate(628px, 488px) scale(0.997); }
                        33.17% { opacity: 1; transform: translate(550px, 490px) scale(1.0); }
                        34.44% { opacity: 1; transform: translate(472px, 488px) scale(0.997); }
                        35.74% { opacity: 1; transform: translate(400px, 481px) scale(0.987); }
                        37.08% { opacity: 1; transform: translate(338px, 469px) scale(0.971); }
                        38.50% { opacity: 1; transform: translate(290px, 455px) scale(0.95); }
                        40.02% { opacity: 1; transform: translate(260px, 438px) scale(0.926); }
                        41.66% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        41.67% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        43.46% { opacity: 0; transform: translate(260px, 402px) scale(0.874); }
                        45.44% { opacity: 0; transform: translate(290px, 385px) scale(0.85); }
                        47.62% { opacity: 0; transform: translate(338px, 371px) scale(0.829); }
                        50.00% { opacity: 0; transform: translate(400px, 359px) scale(0.813); }
                        52.54% { opacity: 0; transform: translate(472px, 352px) scale(0.803); }
                        55.17% { opacity: 0; transform: translate(550px, 350px) scale(0.8); }
                        57.80% { opacity: 0; transform: translate(628px, 352px) scale(0.803); }
                        60.34% { opacity: 0; transform: translate(700px, 359px) scale(0.813); }
                        62.71% { opacity: 0; transform: translate(762px, 371px) scale(0.829); }
                        64.90% { opacity: 0; transform: translate(810px, 385px) scale(0.85); }
                        66.88% { opacity: 0; transform: translate(840px, 402px) scale(0.874); }
                        68.68% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        68.69% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        70.32% { opacity: 1; transform: translate(840px, 438px) scale(0.926); }
                        71.84% { opacity: 1; transform: translate(810px, 455px) scale(0.95); }
                        73.25% { opacity: 1; transform: translate(762px, 469px) scale(0.971); }
                        74.60% { opacity: 1; transform: translate(700px, 481px) scale(0.987); }
                        75.89% { opacity: 1; transform: translate(628px, 488px) scale(0.997); }
                        77.17% { opacity: 1; transform: translate(550px, 490px) scale(1.0); }
                        78.44% { opacity: 1; transform: translate(472px, 488px) scale(0.997); }
                        79.74% { opacity: 1; transform: translate(400px, 481px) scale(0.987); }
                        81.08% { opacity: 1; transform: translate(338px, 469px) scale(0.971); }
                        82.50% { opacity: 1; transform: translate(290px, 455px) scale(0.95); }
                        84.02% { opacity: 1; transform: translate(260px, 438px) scale(0.926); }
                        85.66% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        85.67% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        87.46% { opacity: 0; transform: translate(260px, 402px) scale(0.874); }
                        89.44% { opacity: 0; transform: translate(290px, 385px) scale(0.85); }
                        91.62% { opacity: 0; transform: translate(338px, 371px) scale(0.829); }
                        94.00% { opacity: 0; transform: translate(400px, 359px) scale(0.813); }
                        100.00% { opacity: 0; transform: translate(400px, 359px) scale(0); }
                    }

                    @keyframes chat-mascot-star-2-back {
                        0.00% { opacity: 1; transform: translate(400px, 359px) scale(0); }
                        6.00% { opacity: 1; transform: translate(400px, 359px) scale(0.813); }
                        8.54% { opacity: 1; transform: translate(472px, 352px) scale(0.803); }
                        11.17% { opacity: 1; transform: translate(550px, 350px) scale(0.8); }
                        13.80% { opacity: 1; transform: translate(628px, 352px) scale(0.803); }
                        16.34% { opacity: 1; transform: translate(700px, 359px) scale(0.813); }
                        18.71% { opacity: 1; transform: translate(762px, 371px) scale(0.829); }
                        20.90% { opacity: 1; transform: translate(810px, 385px) scale(0.85); }
                        22.88% { opacity: 1; transform: translate(840px, 402px) scale(0.874); }
                        24.68% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        24.69% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        26.32% { opacity: 0; transform: translate(840px, 438px) scale(0.926); }
                        27.84% { opacity: 0; transform: translate(810px, 455px) scale(0.95); }
                        29.25% { opacity: 0; transform: translate(762px, 469px) scale(0.971); }
                        30.60% { opacity: 0; transform: translate(700px, 481px) scale(0.987); }
                        31.89% { opacity: 0; transform: translate(628px, 488px) scale(0.997); }
                        33.17% { opacity: 0; transform: translate(550px, 490px) scale(1.0); }
                        34.44% { opacity: 0; transform: translate(472px, 488px) scale(0.997); }
                        35.74% { opacity: 0; transform: translate(400px, 481px) scale(0.987); }
                        37.08% { opacity: 0; transform: translate(338px, 469px) scale(0.971); }
                        38.50% { opacity: 0; transform: translate(290px, 455px) scale(0.95); }
                        40.02% { opacity: 0; transform: translate(260px, 438px) scale(0.926); }
                        41.66% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        41.67% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        43.46% { opacity: 1; transform: translate(260px, 402px) scale(0.874); }
                        45.44% { opacity: 1; transform: translate(290px, 385px) scale(0.85); }
                        47.62% { opacity: 1; transform: translate(338px, 371px) scale(0.829); }
                        50.00% { opacity: 1; transform: translate(400px, 359px) scale(0.813); }
                        52.54% { opacity: 1; transform: translate(472px, 352px) scale(0.803); }
                        55.17% { opacity: 1; transform: translate(550px, 350px) scale(0.8); }
                        57.80% { opacity: 1; transform: translate(628px, 352px) scale(0.803); }
                        60.34% { opacity: 1; transform: translate(700px, 359px) scale(0.813); }
                        62.71% { opacity: 1; transform: translate(762px, 371px) scale(0.829); }
                        64.90% { opacity: 1; transform: translate(810px, 385px) scale(0.85); }
                        66.88% { opacity: 1; transform: translate(840px, 402px) scale(0.874); }
                        68.68% { opacity: 1; transform: translate(850px, 420px) scale(0.9); }
                        68.69% { opacity: 0; transform: translate(850px, 420px) scale(0.9); }
                        70.32% { opacity: 0; transform: translate(840px, 438px) scale(0.926); }
                        71.84% { opacity: 0; transform: translate(810px, 455px) scale(0.95); }
                        73.25% { opacity: 0; transform: translate(762px, 469px) scale(0.971); }
                        74.60% { opacity: 0; transform: translate(700px, 481px) scale(0.987); }
                        75.89% { opacity: 0; transform: translate(628px, 488px) scale(0.997); }
                        77.17% { opacity: 0; transform: translate(550px, 490px) scale(1.0); }
                        78.44% { opacity: 0; transform: translate(472px, 488px) scale(0.997); }
                        79.74% { opacity: 0; transform: translate(400px, 481px) scale(0.987); }
                        81.08% { opacity: 0; transform: translate(338px, 469px) scale(0.971); }
                        82.50% { opacity: 0; transform: translate(290px, 455px) scale(0.95); }
                        84.02% { opacity: 0; transform: translate(260px, 438px) scale(0.926); }
                        85.66% { opacity: 0; transform: translate(250px, 420px) scale(0.9); }
                        85.67% { opacity: 1; transform: translate(250px, 420px) scale(0.9); }
                        87.46% { opacity: 1; transform: translate(260px, 402px) scale(0.874); }
                        89.44% { opacity: 1; transform: translate(290px, 385px) scale(0.85); }
                        91.62% { opacity: 1; transform: translate(338px, 371px) scale(0.829); }
                        94.00% { opacity: 1; transform: translate(400px, 359px) scale(0.813); }
                        100.00% { opacity: 1; transform: translate(400px, 359px) scale(0); }
                    }

                    @keyframes chat-mascot-rune-orbit-front {
                        0.00% { opacity: 1; transform: translate(0px, 0px) scale(1); }
                        6.00% { opacity: 1; transform: translate(-47px, -110px) scale(0.9); }
                        7.64% { opacity: 1; transform: translate(-57px, -92px) scale(0.926); }
                        9.16% { opacity: 1; transform: translate(-87px, -75px) scale(0.95); }
                        10.57% { opacity: 1; transform: translate(-135px, -61px) scale(0.971); }
                        11.92% { opacity: 1; transform: translate(-197px, -49px) scale(0.987); }
                        13.21% { opacity: 1; transform: translate(-269px, -42px) scale(0.997); }
                        14.49% { opacity: 1; transform: translate(-347px, -40px) scale(1.0); }
                        15.76% { opacity: 1; transform: translate(-425px, -42px) scale(0.997); }
                        17.06% { opacity: 1; transform: translate(-497px, -49px) scale(0.987); }
                        18.41% { opacity: 1; transform: translate(-559px, -61px) scale(0.971); }
                        19.82% { opacity: 1; transform: translate(-607px, -75px) scale(0.95); }
                        21.34% { opacity: 1; transform: translate(-637px, -92px) scale(0.926); }
                        22.98% { opacity: 1; transform: translate(-647px, -110px) scale(0.9); }
                        22.99% { opacity: 0; transform: translate(-647px, -110px) scale(0.9); }
                        24.78% { opacity: 0; transform: translate(-637px, -128px) scale(0.874); }
                        26.76% { opacity: 0; transform: translate(-607px, -145px) scale(0.85); }
                        28.94% { opacity: 0; transform: translate(-559px, -159px) scale(0.829); }
                        31.32% { opacity: 0; transform: translate(-497px, -171px) scale(0.813); }
                        33.86% { opacity: 0; transform: translate(-425px, -178px) scale(0.803); }
                        36.49% { opacity: 0; transform: translate(-347px, -180px) scale(0.8); }
                        39.12% { opacity: 0; transform: translate(-269px, -178px) scale(0.803); }
                        41.66% { opacity: 0; transform: translate(-197px, -171px) scale(0.813); }
                        44.04% { opacity: 0; transform: translate(-135px, -159px) scale(0.829); }
                        46.22% { opacity: 0; transform: translate(-87px, -145px) scale(0.85); }
                        48.20% { opacity: 0; transform: translate(-57px, -128px) scale(0.874); }
                        50.00% { opacity: 0; transform: translate(-47px, -110px) scale(0.9); }
                        50.01% { opacity: 1; transform: translate(-47px, -110px) scale(0.9); }
                        51.64% { opacity: 1; transform: translate(-57px, -92px) scale(0.926); }
                        53.16% { opacity: 1; transform: translate(-87px, -75px) scale(0.95); }
                        54.57% { opacity: 1; transform: translate(-135px, -61px) scale(0.971); }
                        55.92% { opacity: 1; transform: translate(-197px, -49px) scale(0.987); }
                        57.21% { opacity: 1; transform: translate(-269px, -42px) scale(0.997); }
                        58.49% { opacity: 1; transform: translate(-347px, -40px) scale(1.0); }
                        59.76% { opacity: 1; transform: translate(-425px, -42px) scale(0.997); }
                        61.06% { opacity: 1; transform: translate(-497px, -49px) scale(0.987); }
                        62.41% { opacity: 1; transform: translate(-559px, -61px) scale(0.971); }
                        63.82% { opacity: 1; transform: translate(-607px, -75px) scale(0.95); }
                        65.34% { opacity: 1; transform: translate(-637px, -92px) scale(0.926); }
                        66.98% { opacity: 1; transform: translate(-647px, -110px) scale(0.9); }
                        66.99% { opacity: 0; transform: translate(-647px, -110px) scale(0.9); }
                        68.78% { opacity: 0; transform: translate(-637px, -128px) scale(0.874); }
                        70.76% { opacity: 0; transform: translate(-607px, -145px) scale(0.85); }
                        72.94% { opacity: 0; transform: translate(-559px, -159px) scale(0.829); }
                        75.32% { opacity: 0; transform: translate(-497px, -171px) scale(0.813); }
                        77.86% { opacity: 0; transform: translate(-425px, -178px) scale(0.803); }
                        80.49% { opacity: 0; transform: translate(-347px, -180px) scale(0.8); }
                        83.12% { opacity: 0; transform: translate(-269px, -178px) scale(0.803); }
                        85.66% { opacity: 0; transform: translate(-197px, -171px) scale(0.813); }
                        88.04% { opacity: 0; transform: translate(-135px, -159px) scale(0.829); }
                        90.22% { opacity: 0; transform: translate(-87px, -145px) scale(0.85); }
                        92.20% { opacity: 0; transform: translate(-57px, -128px) scale(0.874); }
                        94.00% { opacity: 0; transform: translate(-47px, -110px) scale(0.9); }
                        94.01% { opacity: 1; transform: translate(-47px, -110px) scale(0.9); }
                        100.00% { opacity: 1; transform: translate(0px, 0px) scale(1); }
                    }

                    @keyframes chat-mascot-rune-orbit-back {
                        0.00% { opacity: 0; transform: translate(0px, 0px) scale(1); }
                        6.00% { opacity: 0; transform: translate(-47px, -110px) scale(0.9); }
                        7.64% { opacity: 0; transform: translate(-57px, -92px) scale(0.926); }
                        9.16% { opacity: 0; transform: translate(-87px, -75px) scale(0.95); }
                        10.57% { opacity: 0; transform: translate(-135px, -61px) scale(0.971); }
                        11.92% { opacity: 0; transform: translate(-197px, -49px) scale(0.987); }
                        13.21% { opacity: 0; transform: translate(-269px, -42px) scale(0.997); }
                        14.49% { opacity: 0; transform: translate(-347px, -40px) scale(1.0); }
                        15.76% { opacity: 0; transform: translate(-425px, -42px) scale(0.997); }
                        17.06% { opacity: 0; transform: translate(-497px, -49px) scale(0.987); }
                        18.41% { opacity: 0; transform: translate(-559px, -61px) scale(0.971); }
                        19.82% { opacity: 0; transform: translate(-607px, -75px) scale(0.95); }
                        21.34% { opacity: 0; transform: translate(-637px, -92px) scale(0.926); }
                        22.98% { opacity: 0; transform: translate(-647px, -110px) scale(0.9); }
                        22.99% { opacity: 1; transform: translate(-647px, -110px) scale(0.9); }
                        24.78% { opacity: 1; transform: translate(-637px, -128px) scale(0.874); }
                        26.76% { opacity: 1; transform: translate(-607px, -145px) scale(0.85); }
                        28.94% { opacity: 1; transform: translate(-559px, -159px) scale(0.829); }
                        31.32% { opacity: 1; transform: translate(-497px, -171px) scale(0.813); }
                        33.86% { opacity: 1; transform: translate(-425px, -178px) scale(0.803); }
                        36.49% { opacity: 1; transform: translate(-347px, -180px) scale(0.8); }
                        39.12% { opacity: 1; transform: translate(-269px, -178px) scale(0.803); }
                        41.66% { opacity: 1; transform: translate(-197px, -171px) scale(0.813); }
                        44.04% { opacity: 1; transform: translate(-135px, -159px) scale(0.829); }
                        46.22% { opacity: 1; transform: translate(-87px, -145px) scale(0.85); }
                        48.20% { opacity: 1; transform: translate(-57px, -128px) scale(0.874); }
                        50.00% { opacity: 1; transform: translate(-47px, -110px) scale(0.9); }
                        50.01% { opacity: 0; transform: translate(-47px, -110px) scale(0.9); }
                        51.64% { opacity: 0; transform: translate(-57px, -92px) scale(0.926); }
                        53.16% { opacity: 0; transform: translate(-87px, -75px) scale(0.95); }
                        54.57% { opacity: 0; transform: translate(-135px, -61px) scale(0.971); }
                        55.92% { opacity: 0; transform: translate(-197px, -49px) scale(0.987); }
                        57.21% { opacity: 0; transform: translate(-269px, -42px) scale(0.997); }
                        58.49% { opacity: 0; transform: translate(-347px, -40px) scale(1.0); }
                        59.76% { opacity: 0; transform: translate(-425px, -42px) scale(0.997); }
                        61.06% { opacity: 0; transform: translate(-497px, -49px) scale(0.987); }
                        62.41% { opacity: 0; transform: translate(-559px, -61px) scale(0.971); }
                        63.82% { opacity: 0; transform: translate(-607px, -75px) scale(0.95); }
                        65.34% { opacity: 0; transform: translate(-637px, -92px) scale(0.926); }
                        66.98% { opacity: 0; transform: translate(-647px, -110px) scale(0.9); }
                        66.99% { opacity: 1; transform: translate(-647px, -110px) scale(0.9); }
                        68.78% { opacity: 1; transform: translate(-637px, -128px) scale(0.874); }
                        70.76% { opacity: 1; transform: translate(-607px, -145px) scale(0.85); }
                        72.94% { opacity: 1; transform: translate(-559px, -159px) scale(0.829); }
                        75.32% { opacity: 1; transform: translate(-497px, -171px) scale(0.813); }
                        77.86% { opacity: 1; transform: translate(-425px, -178px) scale(0.803); }
                        80.49% { opacity: 1; transform: translate(-347px, -180px) scale(0.8); }
                        83.12% { opacity: 1; transform: translate(-269px, -178px) scale(0.803); }
                        85.66% { opacity: 1; transform: translate(-197px, -171px) scale(0.813); }
                        88.04% { opacity: 1; transform: translate(-135px, -159px) scale(0.829); }
                        90.22% { opacity: 1; transform: translate(-87px, -145px) scale(0.85); }
                        92.20% { opacity: 1; transform: translate(-57px, -128px) scale(0.874); }
                        94.00% { opacity: 1; transform: translate(-47px, -110px) scale(0.9); }
                        94.01% { opacity: 0; transform: translate(-47px, -110px) scale(0.9); }
                        100.00% { opacity: 0; transform: translate(0px, 0px) scale(1); }
                    }

                    @keyframes chat-mascot-bonk {
                        0% { transform: scale(1, 1); }
                        5%, 30% { transform: scale(1.1, 0.7); }
                        48% { transform: scale(0.93, 1.13); }
                        66% { transform: scale(1.04, 0.96); }
                        84% { transform: scale(0.99, 1.01); }
                        100% { transform: scale(1, 1); }
                    }

                    @keyframes chat-mascot-bonk-burst {
                        0% { opacity: 1; transform: scale(0.45); }
                        60% { opacity: 1; }
                        100% { opacity: 0; transform: scale(1.25); }
                    }

                    @keyframes chat-mascot-float {
                        0%, 100% { transform: translateY(0) rotate(-1deg); }
                        50% { transform: translateY(-12px) rotate(1deg); }
                    }

                    @keyframes chat-mascot-rune-bob {
                        0%, 100% { transform: translate(0, 0) rotate(-4deg); }
                        50% { transform: translate(7px, -10px) rotate(7deg); }
                    }

                    @keyframes chat-mascot-cloak-sway {
                        0%, 100% { transform: rotate(-0.5deg); }
                        50% { transform: rotate(1.3deg); }
                    }

                    @keyframes chat-mascot-blink {
                        0%, 45%, 49%, 100% { transform: scaleY(1); }
                        47% { transform: scaleY(0.08); }
                    }

                    @keyframes chat-mascot-brow-glint {
                        0%, 68%, 78%, 100% {
                            opacity: 0;
                            transform: rotate(-12deg) scale(0.45);
                        }
                        72% {
                            opacity: 1;
                            transform: rotate(0) scale(1);
                        }
                    }
                `}</style>
            </defs>

            <ellipse
                className="chat-mascot-shadow"
                cx="575"
                cy="913"
                rx="183"
                ry="29"
                fill={`url(#${id("shadow-gradient")})`}
                filter={`url(#${id("soft-shadow")})`}
            />

            <g className="chat-mascot-rune-back">
                <path
                    d="M842 466 C868 454 897 449 920 454 C949 483 961 522 952 558 C934 583 903 601 867 610 C850 614 840 606 837 587 C830 548 829 500 842 466Z"
                    fill={`url(#${id("rune-gradient")})`}
                />
                <path
                    d="M880 493 C899 506 910 526 906 545 C901 568 880 580 861 571 C848 564 845 551 851 541 C857 531 869 529 877 536 C884 542 883 551 877 556 C887 555 895 547 895 537 C896 523 887 511 873 504Z"
                    fill={mascotColors.accentLight}
                />
            </g>

            <g
                fill={mascotColors.runeHighlight}
                stroke={mascotColors.accentLight}
                strokeWidth="5"
                strokeLinejoin="round"
            >
                <path
                    className="chat-mascot-star chat-mascot-star-1-back"
                    d="M0 -30 L8.8 -12.1 L28.5 -9.3 L14.3 4.6 L17.6 24.3 L0 15 L-17.6 24.3 L-14.3 4.6 L-28.5 -9.3 L-8.8 -12.1 Z"
                />
                <path
                    className="chat-mascot-star chat-mascot-star-2-back"
                    d="M0 -30 L8.8 -12.1 L28.5 -9.3 L14.3 4.6 L17.6 24.3 L0 15 L-17.6 24.3 L-14.3 4.6 L-28.5 -9.3 L-8.8 -12.1 Z"
                />
            </g>

            <g className="chat-mascot-body">
                <g className="chat-mascot-cloak">
                    <path
                        d="M452 644 C516 668 575 689 637 669 C700 648 755 661 795 704 C844 757 844 829 811 887 C798 910 781 932 761 950 C746 964 737 957 739 935 L743 901 C690 965 611 1005 529 1016 C506 1019 497 1008 510 991 C566 918 588 858 558 806 C540 776 506 744 457 715 C431 700 426 658 452 644Z"
                        fill={`url(#${id("cloak-gradient")})`}
                    />
                    <path
                        d="M474 676 C532 696 584 709 638 692 C683 678 721 679 753 700 C719 714 684 745 656 786 C618 842 607 917 542 983 C584 902 597 847 570 798 C550 763 519 731 474 706Z"
                        fill={mascotColors.accentMidtone}
                        opacity="0.24"
                    />
                    <path
                        d="M699 754 C704 771 714 781 733 786 C714 791 704 801 699 820 C694 801 684 791 665 786 C684 781 694 771 699 754Z"
                        fill={mascotColors.accentLight}
                    />
                </g>

                <g className="chat-mascot-head">
                    <path
                        d="M385 682 C320 642 296 579 308 501 C321 417 372 342 440 277 C496 224 555 172 613 124 C629 111 638 117 637 140 C640 214 622 270 610 322 C600 367 615 393 655 411 C723 441 784 482 810 542 C837 604 813 668 762 705 C706 745 632 756 556 741 C494 729 438 713 385 682Z"
                        fill={`url(#${id("hood-gradient")})`}
                    />
                    <path
                        d="M398 663 C449 719 536 744 621 723 C683 708 730 680 761 642 C748 695 704 728 650 743 C566 767 465 740 402 690Z"
                        fill={mascotColors.hoodShadow}
                        opacity="0.82"
                    />
                    <path
                        d="M365 511 C391 461 425 424 454 421 C480 418 494 438 484 462 C475 484 452 505 434 510 C421 514 412 505 415 494 C417 486 424 478 432 476 C443 473 450 479 446 487 C456 480 466 467 468 455 C470 442 460 436 447 440 C417 449 387 483 365 526Z"
                        fill={mascotColors.hoodHighlight}
                        opacity="0.9"
                    />
                    <path
                        d="M408 601 C463 526 548 477 648 466 C706 459 751 472 770 506 C794 549 777 615 733 657 C685 704 607 735 531 727 C468 721 421 695 402 660 C391 639 393 621 408 601Z"
                        fill={`url(#${id("face-gradient")})`}
                    />
                    <g className="chat-mascot-eye">
                        <path
                            d="M466 575 C489 558 527 559 553 579 C544 611 519 628 493 622 C476 618 466 601 466 575Z"
                            fill={mascotColors.featureLight}
                        />
                        <ellipse
                            className="chat-mascot-pupil chat-mascot-pupil-left"
                            cx="507"
                            cy="589"
                            rx="17"
                            ry="25"
                            fill={mascotColors.featureDark}
                        />
                        <circle
                            className="chat-mascot-pupil chat-mascot-pupil-left"
                            cx="500"
                            cy="579"
                            r="8"
                            fill={mascotColors.featureLight}
                        />
                    </g>
                    <path
                        className="chat-mascot-brow chat-mascot-brow-left"
                        d="M471 568 C493 552 523 552 545 566"
                        fill="none"
                        stroke={mascotColors.accentLight}
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    <g className="chat-mascot-eye">
                        <path
                            d="M626 554 C648 537 681 535 704 548 C704 584 686 610 661 614 C638 617 624 593 626 554Z"
                            fill={mascotColors.featureLight}
                        />
                        <ellipse
                            className="chat-mascot-pupil chat-mascot-pupil-right"
                            cx="669"
                            cy="568"
                            rx="16"
                            ry="25"
                            fill={mascotColors.featureDark}
                        />
                        <circle
                            className="chat-mascot-pupil chat-mascot-pupil-right"
                            cx="662"
                            cy="558"
                            r="8"
                            fill={mascotColors.featureLight}
                        />
                    </g>
                    <path
                        className="chat-mascot-brow chat-mascot-brow-right"
                        d="M631 544 C650 529 676 526 698 537"
                        fill="none"
                        stroke={mascotColors.accentLight}
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    <path
                        className="chat-mascot-brow-glint"
                        d="M714 500 C718 515 726 523 741 527 C726 531 718 539 714 554 C710 539 702 531 687 527 C702 523 710 515 714 500Z"
                        fill={mascotColors.featureLight}
                    />
                    <path
                        className="chat-mascot-mouth-smile"
                        d="M558 646 C575 660 602 658 623 635"
                        fill="none"
                        stroke={mascotColors.featureLight}
                        strokeWidth="9"
                        strokeLinecap="round"
                    />
                    <g
                        className="chat-mascot-mood-features"
                        fill="none"
                        stroke={mascotColors.featureLight}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path
                            className="chat-mascot-mood-feature chat-mascot-happy-eye"
                            d="M472 604 C488 578 530 576 548 600"
                            strokeWidth="11"
                        />
                        <path
                            className="chat-mascot-mood-feature chat-mascot-happy-eye"
                            d="M630 588 C646 562 686 560 702 584"
                            strokeWidth="11"
                        />
                        <path
                            className="chat-mascot-mood-feature chat-mascot-mouth-grin"
                            d="M552 640 C574 670 612 668 632 628"
                            strokeWidth="10"
                        />
                        <ellipse
                            className="chat-mascot-mood-feature chat-mascot-mouth-o"
                            cx="592"
                            cy="652"
                            rx="12"
                            ry="15"
                            fill={mascotColors.featureLight}
                            stroke="none"
                        />
                        <path
                            className="chat-mascot-mood-feature chat-mascot-mouth-wavy"
                            d="M562 654 q10 -10 20 0 q10 10 20 0 q10 -10 20 0"
                            strokeWidth="8"
                        />
                        <path
                            className="chat-mascot-mood-feature chat-mascot-mouth-flat"
                            d="M574 652 C584 655 596 654 606 649"
                            strokeWidth="8"
                        />
                        <path
                            className="chat-mascot-mood-feature chat-mascot-sleepy-eye"
                            d="M472 590 C490 612 530 612 548 592"
                            strokeWidth="10"
                        />
                        <path
                            className="chat-mascot-mood-feature chat-mascot-sleepy-eye"
                            d="M630 574 C648 596 686 596 702 576"
                            strokeWidth="10"
                        />
                        <path
                            className="chat-mascot-mood-feature chat-mascot-sweat"
                            d="M748 398 C762 422 774 440 774 456 C774 470 762 481 748 481 C734 481 722 470 722 456 C722 440 734 422 748 398Z"
                            fill={mascotColors.featureLight}
                            stroke={mascotColors.runeShadow}
                            strokeWidth="6"
                        />
                        <g stroke={mascotColors.featureDark} strokeWidth="5">
                            <path
                                className="chat-mascot-mood-feature chat-mascot-spiral"
                                d="M509 591 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0"
                            />
                            <path
                                className="chat-mascot-mood-feature chat-mascot-spiral"
                                d="M665 577 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0"
                            />
                        </g>
                    </g>
                </g>
            </g>

            <g
                fill="none"
                stroke={mascotColors.runeHighlight}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path
                    className="chat-mascot-mood-feature chat-mascot-wave-1"
                    d="M265 580 A40 40 0 0 0 265 620"
                    strokeWidth="10"
                />
                <path
                    className="chat-mascot-mood-feature chat-mascot-wave-2"
                    d="M239 565 A70 70 0 0 0 239 635"
                    strokeWidth="10"
                />
                <path
                    className="chat-mascot-mood-feature chat-mascot-wave-3"
                    d="M213 550 A100 100 0 0 0 213 650"
                    strokeWidth="10"
                />
            </g>
            <g
                fill="none"
                stroke={mascotColors.runeShadow}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path
                    className="chat-mascot-mood-feature chat-mascot-zzz chat-mascot-zzz-1"
                    d="M712 410 h34 l-34 34 h34"
                    strokeWidth="9"
                />
                <path
                    className="chat-mascot-mood-feature chat-mascot-zzz chat-mascot-zzz-2"
                    d="M764 336 h46 l-46 46 h46"
                    strokeWidth="11"
                />
                <path
                    className="chat-mascot-mood-feature chat-mascot-zzz chat-mascot-zzz-3"
                    d="M808 254 h58 l-58 58 h58"
                    strokeWidth="13"
                />
            </g>

            <g
                fill={mascotColors.runeHighlight}
                stroke={mascotColors.accentLight}
                strokeWidth="5"
                strokeLinejoin="round"
            >
                <path
                    className="chat-mascot-star chat-mascot-star-1"
                    d="M0 -30 L8.8 -12.1 L28.5 -9.3 L14.3 4.6 L17.6 24.3 L0 15 L-17.6 24.3 L-14.3 4.6 L-28.5 -9.3 L-8.8 -12.1 Z"
                />
                <path
                    className="chat-mascot-star chat-mascot-star-2"
                    d="M0 -30 L8.8 -12.1 L28.5 -9.3 L14.3 4.6 L17.6 24.3 L0 15 L-17.6 24.3 L-14.3 4.6 L-28.5 -9.3 L-8.8 -12.1 Z"
                />
            </g>

            <path
                className="chat-mascot-bonk"
                d="M538 215 L492 215 M545 189 L505 166 M564 170 L541 130 M590 163 L590 117 M616 170 L639 130 M635 189 L675 166 M642 215 L688 215"
                fill="none"
                stroke={mascotColors.runeHighlight}
                strokeWidth="11"
                strokeLinecap="round"
            />

            <g className="chat-mascot-rune">
                <path
                    d="M842 466 C868 454 897 449 920 454 C949 483 961 522 952 558 C934 583 903 601 867 610 C850 614 840 606 837 587 C830 548 829 500 842 466Z"
                    fill={`url(#${id("rune-gradient")})`}
                />
                <path
                    d="M880 493 C899 506 910 526 906 545 C901 568 880 580 861 571 C848 564 845 551 851 541 C857 531 869 529 877 536 C884 542 883 551 877 556 C887 555 895 547 895 537 C896 523 887 511 873 504Z"
                    fill={mascotColors.accentLight}
                />
            </g>
        </svg>
    )

    if (!pokeable) return svg

    return (
        <button
            type="button"
            aria-label="Poke the familiar"
            onClick={poke}
            // Rapid pokes are double and triple clicks, which would select the greeting.
            onMouseDown={(event) => {
                if (event.detail > 1) event.preventDefault()
            }}
            className={cn("block cursor-default select-none bg-transparent p-0", className)}
        >
            {svg}
        </button>
    )
}
