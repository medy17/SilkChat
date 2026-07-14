import { type TargetAndTransition, type Transition, motion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"

type Snapshot = Record<string, string | number>

const buildKeyframes = (
    from: Snapshot,
    steps: Snapshot[]
): Record<string, Array<string | number>> => {
    const keys = new Set<string>([
        ...Object.keys(from),
        ...steps.flatMap((step) => Object.keys(step))
    ])

    const keyframes: Record<string, Array<string | number>> = {}
    keys.forEach((key) => {
        keyframes[key] = [from[key], ...steps.map((step) => step[key])]
    })
    return keyframes
}

type BlurTextProps = {
    text?: string
    delay?: number
    className?: string
    animateBy?: "words" | "letters"
    direction?: "top" | "bottom"
    threshold?: number
    rootMargin?: string
    animationFrom?: Snapshot
    animationTo?: Snapshot[]
    easing?: (t: number) => number
    onAnimationComplete?: () => void
    stepDuration?: number
}

export function BlurText({
    text = "",
    delay = 200,
    className = "",
    animateBy = "words",
    direction = "top",
    threshold = 0.1,
    rootMargin = "0px",
    animationFrom,
    animationTo,
    easing = (t) => t,
    onAnimationComplete,
    stepDuration = 0.35
}: BlurTextProps) {
    const elements = animateBy === "words" ? text.split(" ") : text.split("")
    const [inView, setInView] = useState(false)
    const ref = useRef<HTMLParagraphElement>(null)

    useEffect(() => {
        const node = ref.current
        if (!node) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true)
                    observer.unobserve(node)
                }
            },
            { threshold, rootMargin }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [threshold, rootMargin])

    const defaultFrom = useMemo<Snapshot>(
        () =>
            direction === "top"
                ? { filter: "blur(10px)", opacity: 0, y: -50 }
                : { filter: "blur(10px)", opacity: 0, y: 50 },
        [direction]
    )

    const defaultTo = useMemo<Snapshot[]>(
        () => [
            {
                filter: "blur(5px)",
                opacity: 0.5,
                y: direction === "top" ? 5 : -5
            },
            { filter: "blur(0px)", opacity: 1, y: 0 }
        ],
        [direction]
    )

    const fromSnapshot = animationFrom ?? defaultFrom
    const toSnapshots = animationTo ?? defaultTo

    const stepCount = toSnapshots.length + 1
    const totalDuration = stepDuration * (stepCount - 1)
    const times = Array.from({ length: stepCount }, (_, i) =>
        stepCount === 1 ? 0 : i / (stepCount - 1)
    )

    return (
        <p ref={ref} className={className} style={{ display: "flex", flexWrap: "wrap" }}>
            {elements.map((segment, index) => {
                const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots)

                const spanTransition: Transition = {
                    duration: totalDuration,
                    times,
                    delay: (index * delay) / 1000,
                    ease: easing
                }

                return (
                    <motion.span
                        className="inline-block will-change-[transform,filter,opacity]"
                        // biome-ignore lint/suspicious/noArrayIndexKey: text segments are positional and stable
                        key={index}
                        initial={fromSnapshot as TargetAndTransition}
                        animate={(inView ? animateKeyframes : fromSnapshot) as TargetAndTransition}
                        transition={spanTransition}
                        onAnimationComplete={
                            index === elements.length - 1 ? onAnimationComplete : undefined
                        }
                    >
                        {segment === " " ? " " : segment}
                        {animateBy === "words" && index < elements.length - 1 && " "}
                    </motion.span>
                )
            })}
        </p>
    )
}
