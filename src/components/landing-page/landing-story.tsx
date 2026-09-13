"use client"

import {
    motion,
    type MotionValue,
    useMotionValue,
    useMotionValueEvent,
    useReducedMotion,
    useSpring,
    useTransform
} from "motion/react"
import {
    createContext,
    type ReactNode,
    type RefObject,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from "react"
import { createPortal } from "react-dom"

import { useMediaQuery } from "@/hooks/use-media-query"
import {
    type LandingVisualArrival,
    landingSceneVisibility,
    landingVisualProgress
} from "@/lib/landing-scroll"
import { type LandingScrollProps, useLandingScroll } from "./use-landing-scroll"

const StageContext = createContext<{ host: HTMLDivElement | null; inline: boolean }>({
    host: null,
    inline: true
})
const SceneContext = createContext<{ progress: MotionValue<number>; staged: boolean } | null>(null)
const PropSideContext = createContext<"left" | "right">("left")

export function LandingSceneGroup({
    propSide,
    children
}: {
    propSide: "left" | "right"
    children: ReactNode
}) {
    return <PropSideContext.Provider value={propSide}>{children}</PropSideContext.Provider>
}

export function LandingStory({ children }: { children: ReactNode }) {
    const [host, setHost] = useState<HTMLDivElement | null>(null)
    const mobile = useMediaQuery("(max-width: 767px)", { initializeWithValue: false })
    const reduced = useReducedMotion() === true
    const inline = mobile || reduced
    return (
        <StageContext.Provider value={{ host, inline }}>
            <div className="landing-wrap landing-story" data-inline={inline ? "true" : undefined}>
                <div className="landing-story-stage-column">
                    <div ref={setHost} className="landing-story-stage" />
                </div>
                <div className="landing-story-chapters">
                    {children}
                    <div className="landing-story-runout" aria-hidden="true" />
                </div>
            </div>
        </StageContext.Provider>
    )
}

export function LandingScene({
    id,
    children,
    visual,
    containerRef,
    sceneRef: suppliedRef,
    propSide: suppliedSide,
    arrival = "with-transition",
    release = false
}: LandingScrollProps & {
    id?: string
    children: ReactNode
    visual: ReactNode
    sceneRef?: RefObject<HTMLElement | null>
    release?: boolean
    propSide?: "left" | "right"
    arrival?: LandingVisualArrival
}) {
    const inheritedSide = useContext(PropSideContext)
    const propSide = suppliedSide ?? inheritedSide
    const localRef = useRef<HTMLElement>(null)
    const sceneRef = suppliedRef ?? localRef
    const { host, inline } = useContext(StageContext)
    const { progress: phase, viewportRatio } = useLandingScroll(containerRef, sceneRef, "scene")
    // The last composition leaves with the stage itself as pricing enters.
    const compositionPhase = useTransform(() =>
        release ? Math.min(0.8, phase.get()) : phase.get()
    )
    const progress = useTransform(() => landingVisualProgress(compositionPhase.get(), arrival))
    const opacity = useTransform(
        () => landingSceneVisibility(compositionPhase.get(), viewportRatio.get()).visual
    )
    const scale = useTransform(compositionPhase, [0, 0.12, 0.88, 1], [0.98, 1, 1, 1.02])
    const [active, setActive] = useState(false)
    const updateActive = useCallback((value: number) => setActive(value > 0 && value < 1), [])
    useMotionValueEvent(compositionPhase, "change", updateActive)
    useEffect(() => updateActive(compositionPhase.get()), [compositionPhase, updateActive])
    const staged = !inline && host !== null
    const panel = (
        <motion.div
            className="landing-story-composition"
            data-prop-side={propSide}
            data-scene={id}
            style={{ opacity, scale, pointerEvents: active ? "auto" : "none" }}
            aria-hidden={!active}
            inert={!active}
        >
            <div className="landing-story-copy">{children}</div>
            <div className="landing-story-visual" data-prop-side={propSide}>
                {visual}
            </div>
        </motion.div>
    )
    return (
        <SceneContext.Provider value={{ progress, staged }}>
            <section
                id={id}
                ref={sceneRef}
                className="landing-story-scene"
                data-prop-side={propSide}
            >
                {staged ? (
                    createPortal(panel, host)
                ) : (
                    <>
                        <div className="landing-story-copy">{children}</div>
                        <div className="landing-story-inline-visual">{visual}</div>
                    </>
                )}
            </section>
        </SceneContext.Provider>
    )
}

export function useLandingVisual(
    containerRef: LandingScrollProps["containerRef"],
    visualRef: RefObject<HTMLElement | null>,
    mode: "focus" | "pass" = "focus"
) {
    const scene = useContext(SceneContext)
    const local = useLandingScroll(containerRef, visualRef, mode, !scene?.staged)
    const target = useTransform(() => (scene?.staged ? scene.progress.get() : local.progress.get()))
    const smooth = useSpring(target, { stiffness: 120, damping: 28, mass: 0.45 })
    return { ...local, progress: local.reduced ? target : smooth }
}

export function useLandingVisualScale(visualRef: RefObject<HTMLElement | null>) {
    const { host } = useContext(StageContext)
    const scene = useContext(SceneContext)
    const staged = scene?.staged === true
    const scale = useMotionValue(1)
    useEffect(() => {
        const visual = visualRef.current
        if (!staged || !host || !visual) {
            scale.set(1)
            return
        }
        // Fit the complete working demo on short screens, including its
        // button, without adding a second vertical scroller to the page.
        const measure = () =>
            scale.set(
                Math.min(
                    1,
                    (visual.closest(".landing-story-visual")?.clientHeight ?? host.clientHeight) /
                        Math.max(1, visual.offsetHeight)
                )
            )
        const observer = new ResizeObserver(measure)
        observer.observe(host)
        observer.observe(visual)
        measure()
        return () => observer.disconnect()
    }, [staged, host, visualRef, scale])
    return scale
}
