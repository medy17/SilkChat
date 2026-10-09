"use client"

import { ArrowRight, Images, LayersPlus, SlidersHorizontal } from "lucide-react"
import {
    type MotionValue,
    motion,
    useMotionValue,
    useReducedMotion,
    useSpring,
    useTransform
} from "motion/react"
import { type PointerEvent, type RefObject, useRef, useState } from "react"

import { type GalleryImage, galleryImages } from "@/components/landing-page/content"
import { LibraryLightbox } from "@/components/landing-page/library-lightbox"
import { Capability, RevealedText, useSceneProgress } from "@/components/landing-page/scroll-scene"
import { SignInButton } from "@/components/landing-page/shared"
import { LibraryLogo } from "@/components/logo"
import { useMediaQuery } from "@/hooks/use-media-query"

const capabilities = [
    { label: "Concurrent generations", Icon: LayersPlus },
    { label: "Detailed parameters on every image", Icon: SlidersHorizontal },
    { label: "A library built for browsing", Icon: Images }
]

// The scene plays out in three acts: six prints generate side by side in a
// library-style grid, each develops from a grey blur into full colour, then
// the grid breaks apart into a loose pile that keeps drifting while the copy
// is read. Offsets are percentages of a print's own size; prints are 30% of
// the stage, so 110% steps leave a small gutter.
const prints = [
    { grid: { x: -110, y: -55 }, pile: { x: -118, y: -98, turn: -9 }, depth: 2, develops: 1 },
    { grid: { x: 0, y: -55 }, pile: { x: 6, y: -124, turn: 4 }, depth: 4, develops: 3 },
    { grid: { x: 110, y: -55 }, pile: { x: 122, y: -72, turn: 8 }, depth: 1, develops: 0 },
    { grid: { x: -110, y: 55 }, pile: { x: -122, y: 78, turn: 6 }, depth: 3, develops: 4 },
    { grid: { x: 0, y: 55 }, pile: { x: 4, y: 104, turn: -5 }, depth: 5, develops: 2 },
    { grid: { x: 110, y: 55 }, pile: { x: 116, y: 96, turn: -8 }, depth: 2, develops: 5 }
]
const sceneImages = galleryImages.slice(0, prints.length)
const pathStops = [-0.6, 0.12, 0.5, 1.3]
const DEVELOP_SPAN = 0.16
const developStart = (order: number) => -0.38 + order * 0.055

function usePrintPath(index: number, progress: MotionValue<number>) {
    const { grid, pile, depth } = prints[index]
    const drift = 1 + depth * 0.03
    return {
        x: useTransform(progress, pathStops, [
            `${grid.x}%`,
            `${grid.x}%`,
            `${pile.x}%`,
            `${pile.x * drift}%`
        ]),
        y: useTransform(progress, pathStops, [
            `${grid.y}%`,
            `${grid.y}%`,
            `${pile.y}%`,
            `${pile.y - depth * 6}%`
        ]),
        rotate: useTransform(progress, pathStops, [0, 0, pile.turn, pile.turn * 1.4]),
        scale: useTransform(progress, pathStops, [0.94, 0.94, 1 + depth * 0.04, 1 + depth * 0.05])
    }
}

const printFrame = "absolute top-1/2 left-1/2 -mt-[15%] -ml-[15%] w-[30%]"

function Print({
    image,
    index,
    progress,
    pointerX,
    reduced,
    onOpen
}: {
    image: GalleryImage
    index: number
    progress: MotionValue<number>
    pointerX: MotionValue<number>
    reduced: boolean
    onOpen: () => void
}) {
    const { pile, depth, develops } = prints[index]
    const path = usePrintPath(index, progress)
    const start = developStart(develops)
    const end = start + DEVELOP_SPAN

    const imageOpacity = useTransform(progress, [start, start + 0.06], [0, 1])
    const imageScale = useTransform(progress, [start, end], [1.18, 1])
    const imageFilter = useTransform(
        progress,
        [start, end],
        ["blur(14px) saturate(0)", "blur(0px) saturate(1)"]
    )
    // Nearer prints shift further with the pointer, giving the pile depth.
    const parallax = useTransform(pointerX, (value) => value * depth * 10)

    return (
        <motion.div
            style={
                reduced
                    ? { x: `${pile.x}%`, y: `${pile.y}%`, rotate: pile.turn, zIndex: depth }
                    : { ...path, zIndex: depth }
            }
            className={printFrame}
        >
            <motion.button
                type="button"
                onClick={onOpen}
                aria-label={`Open "${image.prompt}"`}
                style={reduced ? undefined : { x: parallax }}
                className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-lg)] border shadow-2xl transition-[scale] duration-300 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <motion.img
                    src={image.img}
                    alt=""
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={
                        reduced
                            ? undefined
                            : { opacity: imageOpacity, scale: imageScale, filter: imageFilter }
                    }
                    className="absolute inset-0 size-full object-cover"
                />
            </motion.button>
        </motion.div>
    )
}

export function ImageGallerySection({
    containerRef
}: {
    containerRef: RefObject<HTMLDivElement | null>
}) {
    const sceneRef = useRef<HTMLElement>(null)
    const reduced = useReducedMotion() === true
    const finePointer = useMediaQuery("(pointer: fine)")
    const progress = useSceneProgress({ containerRef, sceneRef })
    const [activeIndex, setActiveIndex] = useState<number | null>(null)

    // Pointer position across the stage, -0.5..0.5 on each axis.
    const rawPointerX = useMotionValue(0)
    const rawPointerY = useMotionValue(0)
    const pointerX = useSpring(rawPointerX, { stiffness: 120, damping: 18 })
    const pointerY = useSpring(rawPointerY, { stiffness: 120, damping: 18 })
    const tiltY = useTransform(pointerX, [-0.5, 0.5], [-10, 10])
    const tiltX = useTransform(pointerY, [-0.5, 0.5], [8, -8])
    const interactive = finePointer && !reduced

    const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
        if (!interactive) return
        const rect = event.currentTarget.getBoundingClientRect()
        rawPointerX.set((event.clientX - rect.left) / rect.width - 0.5)
        rawPointerY.set((event.clientY - rect.top) / rect.height - 0.5)
    }
    const resetPointer = () => {
        rawPointerX.set(0)
        rawPointerY.set(0)
    }

    return (
        <section
            id="gallery"
            ref={sceneRef}
            className="overflow-x-clip border-t py-20 [border-color:var(--landing-border)] md:py-32"
        >
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:grid-cols-2 md:px-8 lg:gap-20">
                <div className="order-2 md:order-1">
                    <motion.div
                        onPointerMove={trackPointer}
                        onPointerLeave={resetPointer}
                        style={
                            interactive
                                ? { rotateX: tiltX, rotateY: tiltY, transformPerspective: 1200 }
                                : undefined
                        }
                        className="relative mx-auto aspect-square w-full max-w-xl"
                    >
                        {sceneImages.map((image, index) => (
                            <Print
                                key={image.id}
                                image={image}
                                index={index}
                                progress={progress}
                                pointerX={pointerX}
                                reduced={reduced}
                                onOpen={() => setActiveIndex(index)}
                            />
                        ))}
                    </motion.div>
                </div>

                <div className="order-1 md:order-2">
                    <h2 className="mb-5">
                        <span className="sr-only">SilkScreen</span>
                        <span aria-hidden="true">
                            <LibraryLogo className="h-10 w-auto md:h-12" />
                        </span>
                    </h2>
                    <p className="mb-8 max-w-md text-base leading-relaxed [color:var(--landing-muted)] md:text-lg">
                        <RevealedText
                            text="Envision your ideas with GPT Image 2, Seedream 5 Pro, Nano Banana Pro, FLUX.2 [flex], and more in a first-class library made for concurrent generation and detailed parameters."
                            progress={progress}
                            reduced={reduced}
                        />
                    </p>
                    <ul className="mb-10 space-y-4">
                        {capabilities.map(({ label, Icon }, index) => (
                            <Capability
                                key={label}
                                label={label}
                                Icon={Icon}
                                index={index}
                                progress={progress}
                                reduced={reduced}
                            />
                        ))}
                    </ul>
                    <SignInButton className="gap-2">
                        Start generating
                        <ArrowRight className="size-4" />
                    </SignInButton>
                </div>
            </div>

            <LibraryLightbox
                images={sceneImages}
                index={activeIndex}
                onClose={() => setActiveIndex(null)}
                onNavigate={setActiveIndex}
            />
        </section>
    )
}
