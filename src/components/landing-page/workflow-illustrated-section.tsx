"use client"

import { easeOut, type MotionValue, motion, useReducedMotion, useTransform } from "motion/react"
import { createRef, type RefObject, useRef, useState } from "react"

import { type LandingIcon, type UseCase, useCases } from "@/components/landing-page/content"
import { SectionHead } from "@/components/landing-page/shared"
import { LandingScene, LandingSceneGroup, useLandingVisual } from "./landing-story"
import { useLandingScroll } from "./use-landing-scroll"

const objects = [
    { src: "/images/workflows/cube.webp", alt: "An interlocking brushed silver cube", rotate: -7 },
    { src: "/images/workflows/ribbon.webp", alt: "A looping ivory paper sculpture", rotate: 6 },
    { src: "/images/workflows/prism.webp", alt: "A triangular optical glass prism", rotate: -4 },
    { src: "/images/workflows/mask.webp", alt: "An ivory porcelain Venetian mask", rotate: 7 }
]

// Different trajectories reinforce the materials: the cube turns, the paper
// sweeps, the prism rises, and the mask approaches before drifting away.
const choreography = [
    {
        x: [-90, -24, 6, 24, 90],
        y: [65, 16, -6, -18, -65],
        turn: [-16, -6, 0, 4, 14],
        light: [-70, -20, 30, 60, 100]
    },
    {
        x: [90, 26, 0, -26, -100],
        y: [35, -18, -30, -12, 50],
        turn: [18, 6, -3, -8, -18],
        light: [100, 45, 0, -40, -100]
    },
    {
        x: [-25, -10, 0, 12, 35],
        y: [100, 25, 0, -20, -95],
        turn: [-9, -3, 0, 3, 9],
        light: [-80, -35, 10, 45, 80]
    },
    {
        x: [-65, -20, 5, 20, 65],
        y: [35, 8, -4, 10, 45],
        turn: [-12, -5, 0, 4, 11],
        light: [70, 30, -10, -35, -70]
    }
]
const sceneStops = [0, 0.25, 0.5, 0.75, 1]

type SceneRefs = {
    containerRef: RefObject<HTMLDivElement | null>
    sceneRef: RefObject<HTMLElement | null>
}

function OverviewObject({
    index,
    progress,
    reduced
}: {
    index: number
    progress: MotionValue<number>
    reduced: boolean
}) {
    const object = objects[index]
    const direction = index % 2 === 0 ? -1 : 1
    const x = useTransform(progress, [0, 0.5, 1], [direction * 36, 0, direction * 12], {
        ease: easeOut
    })
    const y = useTransform(progress, [0, 0.5, 1], [index < 2 ? -24 : 24, 0, -12], {
        ease: easeOut
    })
    const rotate = useTransform(progress, [0, 0.5, 1], [direction * 14, 0, direction * -5], {
        ease: easeOut
    })
    const scale = useTransform(progress, [0, 0.5, 1], [0.72, 1, 0.94], { ease: easeOut })
    return (
        <motion.img
            src={object.src}
            alt={object.alt}
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
            style={reduced ? undefined : { x, y, rotate, scale }}
        />
    )
}

function WorkflowOverview({ containerRef }: { containerRef: SceneRefs["containerRef"] }) {
    const visualRef = useRef<HTMLDivElement>(null)
    const { progress, reduced } = useLandingVisual(containerRef, visualRef)
    return (
        <div ref={visualRef} className="landing-workflow-overview">
            {objects.map((object, index) => (
                <OverviewObject
                    key={object.src}
                    index={index}
                    progress={progress}
                    reduced={reduced}
                />
            ))}
        </div>
    )
}

function useSceneProgress({ containerRef, sceneRef }: SceneRefs) {
    return useLandingScroll(containerRef, sceneRef, "scene").progress
}

function AnchoredObject({ index, ...refs }: SceneRefs & { index: number }) {
    const visualRef = useRef<HTMLDivElement>(null)
    const { progress } = useLandingVisual(refs.containerRef, visualRef)
    const object = objects[index]
    const path = choreography[index]
    const x = useTransform(progress, sceneStops, path.x)
    const y = useTransform(progress, sceneStops, path.y)
    const scale = useTransform(progress, sceneStops, [0.72, 0.91, 1.02, 0.97, 0.78])
    const rotate = useTransform(progress, sceneStops, path.turn)
    const lightX = useTransform(progress, sceneStops, path.light)
    const lightScale = useTransform(progress, sceneStops, [0.65, 1, 1.2, 1, 0.65])
    const filter = useTransform(progress, sceneStops, [
        "blur(7px) brightness(0.7)",
        "blur(0px) brightness(0.92)",
        "blur(0px) brightness(1.05)",
        "blur(0px) brightness(0.94)",
        "blur(7px) brightness(0.7)"
    ])
    const shadowScale = useTransform(progress, sceneStops, [0.5, 0.8, 1, 0.85, 0.5])
    return (
        <div ref={visualRef} className="absolute inset-0">
            <motion.div
                style={{ opacity: 0.8, x: lightX, scale: lightScale }}
                className="pointer-events-none absolute -inset-x-16 inset-y-0 [background:radial-gradient(ellipse_at_45%_45%,color-mix(in_oklab,var(--landing-fg)_13%,transparent),transparent_65%)]"
            />
            <motion.div
                style={{ opacity: 0.8, x: lightX, rotate, scale: lightScale }}
                className="pointer-events-none absolute inset-0 [background:conic-gradient(from_220deg_at_50%_55%,transparent_0deg,color-mix(in_oklab,var(--landing-fg)_7%,transparent)_35deg,transparent_70deg,transparent_360deg)] [mask-image:radial-gradient(ellipse,black_15%,transparent_68%)]"
            />
            <motion.div
                style={{ opacity: 0.8, scaleX: shadowScale, x }}
                className="pointer-events-none absolute inset-x-16 bottom-[8%] h-[8%] blur-lg [background:radial-gradient(ellipse,var(--landing-border-strong),transparent_70%)]"
            />
            <motion.img
                src={object.src}
                alt=""
                aria-hidden="true"
                width={1024}
                height={1024}
                loading="lazy"
                decoding="async"
                style={{ x, y, scale, rotate, filter }}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
        </div>
    )
}

function RevealedWord({
    word,
    index,
    progress
}: {
    word: string
    index: number
    progress: MotionValue<number>
}) {
    const start = -0.18 + index * 0.012
    const opacity = useTransform(progress, [start, start + 0.18], [0.3, 1])
    return <motion.span style={{ opacity }}>{word} </motion.span>
}

function Capability({
    label,
    Icon,
    index,
    progress,
    reduced
}: {
    label: string
    Icon: LandingIcon
    index: number
    progress: MotionValue<number>
    reduced: boolean
}) {
    const start = -0.15 + index * 0.08
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

function WorkflowScene({
    index,
    role,
    reduced,
    ...refs
}: SceneRefs & {
    index: number
    role: UseCase
    reduced: boolean
}) {
    const progress = useSceneProgress(refs)
    const object = objects[index]
    return (
        <LandingScene
            containerRef={refs.containerRef}
            sceneRef={refs.sceneRef}
            visual={
                reduced ? (
                    <img
                        src={object.src}
                        alt={object.alt}
                        width={1024}
                        height={1024}
                        className="landing-workflow-static"
                    />
                ) : (
                    <div className="landing-workflow-prop">
                        <AnchoredObject index={index} {...refs} />
                    </div>
                )
            }
        >
            <div>
                <h3 className="mb-5 font-medium text-2xl leading-tight [color:var(--landing-fg)] md:text-3xl">
                    {role.title}
                </h3>
                <p className="mb-8 max-w-md text-base leading-relaxed [color:var(--landing-muted)] md:text-lg">
                    {reduced
                        ? role.description
                        : role.description
                              .split(" ")
                              .map((word, wordIndex) => (
                                  <RevealedWord
                                      key={`${wordIndex}-${word}`}
                                      word={word}
                                      index={wordIndex}
                                      progress={progress}
                                  />
                              ))}
                </p>
                <ul className="space-y-4">
                    {role.items.map(({ label, Icon }, itemIndex) => (
                        <Capability
                            key={label}
                            label={label}
                            Icon={Icon}
                            index={itemIndex}
                            progress={progress}
                            reduced={reduced}
                        />
                    ))}
                </ul>
            </div>
        </LandingScene>
    )
}

export function WorkflowIllustratedSection({
    containerRef
}: {
    containerRef: RefObject<HTMLDivElement | null>
}) {
    const reduced = useReducedMotion() === true
    const [sceneRefs] = useState(() => useCases.map(() => createRef<HTMLElement>()))
    return (
        <LandingSceneGroup propSide="right">
            <section id="workflows">
                <LandingScene
                    containerRef={containerRef}
                    visual={<WorkflowOverview containerRef={containerRef} />}
                >
                    <SectionHead className="mb-0" title="Built for Every Workflow">
                        Whether you are writing code, researching sources, generating images, or
                        building characters, SilkChat adapts to the work in front of you.
                    </SectionHead>
                </LandingScene>
                {useCases.map((role, index) => (
                    <WorkflowScene
                        key={role.title}
                        role={role}
                        index={index}
                        containerRef={containerRef}
                        sceneRef={sceneRefs[index]}
                        reduced={reduced}
                    />
                ))}
            </section>
        </LandingSceneGroup>
    )
}
