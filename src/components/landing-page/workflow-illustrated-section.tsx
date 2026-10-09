"use client"

import { motion, useReducedMotion, useTransform } from "motion/react"
import { createRef, type RefObject, useRef, useState } from "react"

import { type UseCase, useCases } from "@/components/landing-page/content"
import {
    Capability,
    RevealedText,
    type SceneRefs,
    useSceneProgress
} from "@/components/landing-page/scroll-scene"
import { SectionHead } from "@/components/landing-page/shared"
import { cn } from "@/lib/utils"
import { workflowObjectOpacity } from "@/lib/workflow-scene"

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
const sceneStops = [-0.2, 0.15, 0.5, 0.85, 1.2]

function AnchoredObject({ index, ...refs }: SceneRefs & { index: number }) {
    const progress = useSceneProgress(refs)
    const object = objects[index]
    const path = choreography[index]
    const opacity = useTransform(() => workflowObjectOpacity(progress.get()))
    const x = useTransform(progress, sceneStops, path.x)
    const y = useTransform(progress, sceneStops, path.y)
    const scale = useTransform(progress, sceneStops, [0.72, 0.91, 1.02, 0.97, 0.78])
    const rotate = useTransform(progress, sceneStops, path.turn)
    const lightX = useTransform(progress, sceneStops, path.light)
    const lightScale = useTransform(progress, sceneStops, [0.65, 1, 1.2, 1, 0.65])
    const atmosphere = useTransform(() => workflowObjectOpacity(progress.get()) * 0.8)
    const filter = useTransform(progress, sceneStops, [
        "blur(7px) brightness(0.7)",
        "blur(0px) brightness(0.92)",
        "blur(0px) brightness(1.05)",
        "blur(0px) brightness(0.94)",
        "blur(7px) brightness(0.7)"
    ])
    const shadowScale = useTransform(progress, sceneStops, [0.5, 0.8, 1, 0.85, 0.5])
    return (
        <>
            <motion.div
                style={{ opacity: atmosphere, x: lightX, scale: lightScale }}
                className="pointer-events-none absolute -inset-x-16 inset-y-0 [background:radial-gradient(ellipse_at_45%_45%,color-mix(in_oklab,var(--landing-fg)_13%,transparent),transparent_65%)]"
            />
            <motion.div
                style={{ opacity: atmosphere, x: lightX, rotate, scale: lightScale }}
                className="pointer-events-none absolute inset-0 [background:conic-gradient(from_220deg_at_50%_55%,transparent_0deg,color-mix(in_oklab,var(--landing-fg)_7%,transparent)_35deg,transparent_70deg,transparent_360deg)] [mask-image:radial-gradient(ellipse,black_15%,transparent_68%)]"
            />
            <motion.div
                style={{ opacity: atmosphere, scaleX: shadowScale, x }}
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
                style={{ opacity, x, y, scale, rotate, filter }}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
        </>
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
    const opacity = useTransform(progress, [-0.3, 0.15, 0.95, 1.35], [0.4, 1, 1, 0.4])
    const y = useTransform(progress, [-0.3, 0.15], [24, 0])
    const object = objects[index]
    return (
        <article
            ref={refs.sceneRef}
            className={cn(
                "flex flex-col justify-center py-10",
                !reduced && "md:min-h-[min(70svh,40rem)] md:py-16"
            )}
        >
            <motion.img
                src={object.src}
                alt={object.alt}
                width={1024}
                height={1024}
                loading="lazy"
                decoding="async"
                style={reduced ? undefined : { opacity, y }}
                className={cn(
                    "mx-auto mb-6 aspect-square w-full max-w-72 object-contain",
                    !reduced && "md:hidden"
                )}
            />
            <motion.div style={reduced ? undefined : { opacity, y }}>
                <h3 className="mb-5 font-medium text-2xl leading-tight [color:var(--landing-fg)] md:text-3xl">
                    {role.title}
                </h3>
                <p className="mb-8 max-w-md text-base leading-relaxed [color:var(--landing-muted)] md:text-lg">
                    <RevealedText text={role.description} progress={progress} reduced={reduced} />
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
            </motion.div>
        </article>
    )
}

export function WorkflowIllustratedSection({
    containerRef
}: {
    containerRef: RefObject<HTMLDivElement | null>
}) {
    const reduced = useReducedMotion() === true
    const [sceneRefs] = useState(() => useCases.map(() => createRef<HTMLElement>()))
    const stageRef = useRef<HTMLDivElement>(null)
    return (
        <section
            id="workflows"
            className="border-t py-16 [border-color:var(--landing-border)] md:py-24"
        >
            <div className="mx-auto max-w-7xl px-5 md:px-8">
                <SectionHead className="mb-6 md:mb-8" title="Built for Every Workflow">
                    Whether you are writing code, researching sources, generating images, or
                    building characters, SilkChat adapts to the work in front of you.
                </SectionHead>
                <div
                    className={cn(
                        "grid gap-x-12 lg:gap-x-20",
                        reduced ? "md:grid-cols-2 md:gap-y-8" : "md:grid-cols-2"
                    )}
                >
                    {!reduced && (
                        <div aria-hidden="true" className="relative hidden md:block">
                            <div
                                ref={stageRef}
                                className="sticky top-24 isolate h-[min(70svh,40rem)] overflow-clip"
                            >
                                {objects.map(({ src }, index) => (
                                    <AnchoredObject
                                        key={src}
                                        index={index}
                                        containerRef={containerRef}
                                        sceneRef={sceneRefs[index]}
                                        anchorRef={stageRef}
                                    />
                                ))}
                                <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_45%,var(--landing-bg)_95%)]" />
                            </div>
                        </div>
                    )}
                    <div className={cn(reduced && "contents")}>
                        {useCases.map((role, index) => (
                            <WorkflowScene
                                key={role.title}
                                role={role}
                                index={index}
                                containerRef={containerRef}
                                sceneRef={sceneRefs[index]}
                                anchorRef={stageRef}
                                reduced={reduced}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
