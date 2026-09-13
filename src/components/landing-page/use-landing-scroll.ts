"use client"

import { useMotionValue, useReducedMotion } from "motion/react"
import { type RefObject, useEffect } from "react"

import { landingScrollProgress } from "@/lib/landing-scroll"

export type LandingScrollProps = { containerRef: RefObject<HTMLDivElement | null> }

export function useLandingScroll(
    containerRef: RefObject<HTMLDivElement | null>,
    sectionRef: RefObject<HTMLElement | null>,
    mode: "enter" | "hold" | "pass" | "hero" | "focus" | "scene" = "enter",
    enabled = true
) {
    const progress = useMotionValue(0)
    const viewportRatio = useMotionValue(1)
    const reduced = useReducedMotion() === true

    // The container belongs to a parent host element. Its ref is attached after
    // child layout effects, so subscribe after the entire tree has committed.
    useEffect(() => {
        if (!enabled) return
        const container = containerRef.current
        const section = sectionRef.current
        if (!container || !section) return
        const header = container.querySelector(".landing-header")
        let frame = 0
        const measure = () => {
            frame = 0
            const height = section.offsetHeight
            const viewport = container.clientHeight
            viewportRatio.set(viewport / Math.max(1, height))
            const inset = header?.getBoundingClientRect().height ?? 0
            const insetValue = `${inset}px`
            if (container.style.getPropertyValue("--landing-nav-height") !== insetValue) {
                container.style.setProperty("--landing-nav-height", insetValue)
            }
            progress.set(
                reduced
                    ? 1
                    : landingScrollProgress({
                          top:
                              section.getBoundingClientRect().top -
                              container.getBoundingClientRect().top,
                          height,
                          viewport,
                          inset,
                          mode
                      })
            )
        }
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(measure)
        }
        const observer = new ResizeObserver(schedule)
        observer.observe(container)
        observer.observe(section)
        if (header) observer.observe(header)
        if (!reduced) container.addEventListener("scroll", schedule, { passive: true })
        measure()
        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
            container.removeEventListener("scroll", schedule)
        }
    }, [containerRef, sectionRef, progress, viewportRatio, mode, reduced, enabled])

    return { progress, reduced, viewportRatio }
}
