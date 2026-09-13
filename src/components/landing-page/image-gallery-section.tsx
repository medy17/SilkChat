"use client"

import { ImagePlus, Layers, SlidersHorizontal } from "lucide-react"
import { easeOut, motion, useTransform } from "motion/react"
import { useRef, useState } from "react"

import { type GalleryImage, galleryImages } from "@/components/landing-page/content"
import { LibraryLightbox } from "@/components/landing-page/library-lightbox"

import type { LandingScrollProps } from "./use-landing-scroll"
import { LandingScene, useLandingVisual } from "./landing-story"

function Artwork({
    item,
    index,
    onOpen,
    containerRef
}: LandingScrollProps & { item: GalleryImage; index: number; onOpen: () => void }) {
    const frameRef = useRef<HTMLElement>(null)
    const [focused, setFocused] = useState(false)
    const { progress, reduced } = useLandingVisual(containerRef, frameRef, "focus")
    const entry = [0.04 + index * 0.045, 0.52 + index * 0.035]
    const scale = useTransform(progress, entry, [1.16, 1], { ease: easeOut })
    const filter = useTransform(progress, entry, ["blur(8px)", "blur(0px)"], { ease: easeOut })
    const rotate = useTransform(progress, entry, [index % 2 === 0 ? -4 : 4, 0], { ease: easeOut })
    const opacity = useTransform(progress, entry, [0.2, 1], { ease: easeOut })
    return (
        <figure ref={frameRef} className="landing-gallery-item">
            <button
                type="button"
                className="landing-gallery-image"
                aria-haspopup="dialog"
                aria-label={`Open image: ${item.prompt}`}
                onClick={onOpen}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            >
                <motion.span
                    className="landing-gallery-window"
                    style={reduced || focused ? undefined : { opacity }}
                >
                    <motion.img
                        src={item.img}
                        alt={item.prompt}
                        width={item.width}
                        height={item.height}
                        loading="lazy"
                        decoding="async"
                        style={reduced || focused ? undefined : { scale, filter, rotate }}
                    />
                </motion.span>
            </button>
            <figcaption>{item.label}</figcaption>
        </figure>
    )
}

function GalleryVisual({ containerRef }: LandingScrollProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    return (
        <>
            <div className="landing-story-gallery">
                {galleryImages.map((item, index) => (
                    <Artwork
                        key={item.id}
                        item={item}
                        index={index}
                        containerRef={containerRef}
                        onOpen={() => setActiveIndex(index)}
                    />
                ))}
            </div>
            <LibraryLightbox
                images={galleryImages}
                index={activeIndex}
                onClose={() => setActiveIndex(null)}
                onNavigate={setActiveIndex}
            />
        </>
    )
}
export function ImageGallerySection({ containerRef }: LandingScrollProps) {
    return (
        <LandingScene
            id="gallery"
            propSide="right"
            containerRef={containerRef}
            visual={<GalleryVisual containerRef={containerRef} />}
        >
            <div className="landing-copy landing-gallery-heading">
                <h2 className="landing-heading">An idea, made visible.</h2>
                <ul className="landing-points">
                    <li>
                        <span>
                            <ImagePlus />
                        </span>
                        Generate and edit images
                    </li>
                    <li>
                        <span>
                            <Layers />
                        </span>
                        Run several generations at once
                    </li>
                    <li>
                        <span>
                            <SlidersHorizontal />
                        </span>
                        Choose the model, size, and detail
                    </li>
                </ul>
            </div>
        </LandingScene>
    )
}
