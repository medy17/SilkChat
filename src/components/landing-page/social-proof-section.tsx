"use client"

import { motion, useMotionValue, useTransform } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { type Testimonial, testimonials } from "@/components/landing-page/content"
import type { LandingScrollProps } from "./use-landing-scroll"
import { LandingScene, useLandingVisual } from "./landing-story"

function TestimonialRow({
    row,
    reverse,
    containerRef
}: LandingScrollProps & { row: Testimonial[]; reverse: boolean }) {
    const rowRef = useRef<HTMLDivElement>(null)
    const groupRef = useRef<HTMLDivElement>(null)
    const [manual, setManual] = useState(false)
    const { progress, reduced } = useLandingVisual(containerRef, rowRef, "pass")
    const distance = useMotionValue(0)
    const x = useTransform(() => -distance.get() * (reverse ? 1 - progress.get() : progress.get()))

    useEffect(() => {
        const group = groupRef.current
        if (!group) return
        const measure = () => distance.set(group.getBoundingClientRect().width)
        const observer = new ResizeObserver(measure)
        observer.observe(group)
        measure()
        return () => observer.disconnect()
    }, [distance])

    return (
        <div
            ref={rowRef}
            className="landing-testimonial-row"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: This horizontal scroll region needs keyboard access.
            tabIndex={0}
            role="region"
            aria-label={reverse ? "More testimonials" : "Testimonials"}
            data-manual={manual || reduced ? "true" : undefined}
            onFocus={() => setManual(true)}
            onBlur={() => {
                if (rowRef.current) rowRef.current.scrollLeft = 0
                setManual(false)
            }}
        >
            <motion.div
                className="landing-testimonial-track"
                style={{ x: manual || reduced ? 0 : x }}
            >
                {[0, 1, 2].map((groupIndex) => (
                    <div
                        key={groupIndex}
                        ref={groupIndex === 0 ? groupRef : undefined}
                        className="landing-testimonial-group"
                        aria-hidden={groupIndex > 0 ? true : undefined}
                    >
                        {row.map((testimonial) => (
                            <article key={testimonial.name} className="landing-testimonial">
                                <p>"{testimonial.quote}"</p>
                                <div className="landing-testimonial-attribution">
                                    <div>{testimonial.name}</div>
                                    <div>{testimonial.role}</div>
                                </div>
                            </article>
                        ))}
                    </div>
                ))}
            </motion.div>
        </div>
    )
}

function TestimonialsVisual({ containerRef }: LandingScrollProps) {
    const firstRow = testimonials.filter((_, index) => index % 2 === 0)
    const secondRow = testimonials.filter((_, index) => index % 2 === 1)

    return (
        <div className="landing-testimonial-rows">
            <TestimonialRow row={firstRow} reverse={false} containerRef={containerRef} />
            <TestimonialRow row={secondRow} reverse containerRef={containerRef} />
        </div>
    )
}

export function SocialProofSection({ containerRef }: LandingScrollProps) {
    return (
        <LandingScene
            id="testimonials"
            propSide="left"
            containerRef={containerRef}
            visual={<TestimonialsVisual containerRef={containerRef} />}
        >
            <div className="landing-copy landing-testimonials-heading">
                <h2 className="landing-heading">Loved by Builders</h2>
                <p>
                    Don't just take our word for it. Real workflows are moving into SilkChat because
                    it keeps models, search, images, artifacts, and keys under one roof.
                </p>
            </div>
        </LandingScene>
    )
}
