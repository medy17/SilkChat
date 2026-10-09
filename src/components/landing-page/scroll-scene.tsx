"use client"

import { type MotionValue, motion, useMotionValue, useScroll, useTransform } from "motion/react"
import { type ReactNode, type RefObject, useEffect } from "react"

import type { LandingIcon } from "@/components/landing-page/content"
import { workflowScenePhase } from "@/lib/workflow-scene"

// Shared choreography for the landing page's scroll chapters. Every chapter is
// driven by the same phase value (see workflowScenePhase) so text reveals and
// visuals land at the same scroll positions regardless of section height.

export type SceneRefs = {
    containerRef: RefObject<HTMLDivElement | null>
    sceneRef: RefObject<HTMLElement | null>
    // A sticky visual the scene should line up with. Its pinned center becomes
    // the anchor line; without one (or while it's hidden) the viewport center is.
    anchorRef?: RefObject<HTMLElement | null>
}

// Where a sticky element's center sits once pinned, as a fraction of the
// viewport. Measured from its `top` rule, not its live position, so the
// value is stable whether or not it is currently stuck.
function measureAnchor(container: HTMLElement, anchor: HTMLElement | null | undefined) {
    if (!anchor || anchor.offsetHeight === 0) return 0.5
    const top = Number.parseFloat(getComputedStyle(anchor).top) || 0
    return (top + anchor.offsetHeight / 2) / Math.max(1, container.clientHeight)
}

export function useSceneProgress({ containerRef, sceneRef, anchorRef }: SceneRefs) {
    const ratio = useMotionValue(1)
    const anchor = useMotionValue(0.5)
    const { scrollYProgress } = useScroll({
        container: containerRef,
        target: sceneRef,
        offset: ["start end", "end start"]
    })
    useEffect(() => {
        const container = containerRef.current
        const scene = sceneRef.current
        if (!container || !scene) return
        const anchorElement = anchorRef?.current
        const measure = () => {
            ratio.set(container.clientHeight / Math.max(1, scene.offsetHeight))
            anchor.set(measureAnchor(container, anchorElement))
        }
        const observer = new ResizeObserver(measure)
        observer.observe(container)
        observer.observe(scene)
        if (anchorElement) observer.observe(anchorElement)
        measure()
        return () => observer.disconnect()
    }, [containerRef, sceneRef, anchorRef, ratio, anchor])
    // Function-derived values avoid native timeline offset restrictions.
    return useTransform(() => workflowScenePhase(scrollYProgress.get(), ratio.get(), anchor.get()))
}

function RevealedWord({
    word,
    start,
    progress
}: {
    word: string
    start: number
    progress: MotionValue<number>
}) {
    const opacity = useTransform(progress, [start, start + 0.18], [0.3, 1])
    return <motion.span style={{ opacity }}>{word} </motion.span>
}

// Words brighten one after another as the scene scrolls in.
export function RevealedText({
    text,
    progress,
    reduced,
    from = -0.18,
    step = 0.012
}: {
    text: string
    progress: MotionValue<number>
    reduced: boolean
    from?: number
    step?: number
}) {
    if (reduced) return <>{text}</>
    return (
        <>
            {text.split(" ").map((word, index) => (
                <RevealedWord
                    key={`${index}-${word}`}
                    word={word}
                    start={from + index * step}
                    progress={progress}
                />
            ))}
        </>
    )
}

export function Capability({
    label,
    Icon,
    index,
    progress,
    reduced,
    from = -0.15
}: {
    label: string
    Icon: LandingIcon
    index: number
    progress: MotionValue<number>
    reduced: boolean
    from?: number
}) {
    const start = from + index * 0.08
    const opacity = useTransform(progress, [start, start + 0.22], [0.25, 1])
    const x = useTransform(progress, [start, start + 0.22], [18, 0])
    return (
        <motion.li
            style={reduced ? undefined : { opacity, x }}
            className="flex items-center gap-3 text-sm leading-6 [color:var(--landing-muted)]"
        >
            <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] [background:var(--landing-surface-strong)] [color:var(--landing-fg)]"
            >
                <Icon className="size-4" />
            </span>
            {label}
        </motion.li>
    )
}

// The heading block every chapter opens its text column with.
export function ChapterCopy({
    title,
    description,
    progress,
    reduced
}: {
    title: ReactNode
    description: string
    progress: MotionValue<number>
    reduced: boolean
}) {
    return (
        <>
            <h2 className="mb-5 text-balance font-medium text-3xl leading-[1.05] [color:var(--landing-fg)] md:text-5xl">
                {title}
            </h2>
            <p className="mb-8 max-w-md text-base leading-relaxed [color:var(--landing-muted)] md:text-lg">
                <RevealedText text={description} progress={progress} reduced={reduced} />
            </p>
        </>
    )
}
