"use client"

import { cn } from "@/lib/utils"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

type MobileSnapCarouselProps<T> = {
    items: T[]
    getKey: (item: T) => string
    renderItem: (item: T) => React.ReactNode
    slideClassName?: string
    viewportClassName?: string
    scrollerClassName?: string
}

export function MobileSnapCarousel<T>({
    items,
    getKey,
    renderItem,
    slideClassName = "w-[calc(100vw-3rem)]",
    viewportClassName,
    scrollerClassName
}: MobileSnapCarouselProps<T>) {
    const scrollerRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(items.length > 1)

    const updateScrollState = useCallback(() => {
        const scroller = scrollerRef.current

        if (!scroller) {
            return
        }

        const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth
        setCanScrollLeft(scroller.scrollLeft > 2)
        setCanScrollRight(scroller.scrollLeft < maxScrollLeft - 2)

        const paddingLeft = Number.parseFloat(getComputedStyle(scroller).paddingLeft)
        const snapOffset = scroller.scrollLeft + paddingLeft
        const slides = Array.from(scroller.children) as HTMLElement[]
        const nextActiveIndex = slides.reduce(
            (closest, slide, index) => {
                const distance = Math.abs(slide.offsetLeft - snapOffset)
                return distance < closest.distance ? { index, distance } : closest
            },
            { index: 0, distance: Number.POSITIVE_INFINITY }
        ).index

        setActiveIndex(nextActiveIndex)
    }, [])

    useEffect(() => {
        const scroller = scrollerRef.current

        if (!scroller) {
            return
        }

        updateScrollState()

        const resizeObserver = new ResizeObserver(updateScrollState)
        resizeObserver.observe(scroller)
        scroller.addEventListener("scroll", updateScrollState, { passive: true })

        return () => {
            resizeObserver.disconnect()
            scroller.removeEventListener("scroll", updateScrollState)
        }
    }, [updateScrollState])

    const scrollToIndex = (index: number) => {
        const scroller = scrollerRef.current
        const slide = scroller?.children[index] as HTMLElement | undefined

        if (!scroller || !slide) {
            return
        }

        const paddingLeft = Number.parseFloat(getComputedStyle(scroller).paddingLeft)

        scroller.scrollTo({
            left: slide.offsetLeft - paddingLeft,
            behavior: "smooth"
        })
    }

    return (
        <div
            className={cn(
                "-mx-[50vw] relative right-1/2 left-1/2 w-screen md:hidden",
                viewportClassName
            )}
        >
            <div
                ref={scrollerRef}
                className={cn(
                    "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-6 pb-4 [scroll-padding-inline:1.5rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    scrollerClassName
                )}
            >
                {items.map((item) => (
                    <div key={getKey(item)} className={cn("shrink-0 snap-start", slideClassName)}>
                        {renderItem(item)}
                    </div>
                ))}
            </div>

            <div
                className={cn(
                    "pointer-events-none absolute top-0 bottom-8 left-0 w-10 bg-gradient-to-r from-background to-transparent transition-opacity",
                    canScrollLeft ? "opacity-100" : "opacity-0"
                )}
            />
            <div
                className={cn(
                    "pointer-events-none absolute top-0 right-0 bottom-8 w-10 bg-gradient-to-l from-background to-transparent transition-opacity",
                    canScrollRight ? "opacity-100" : "opacity-0"
                )}
            />

            <div className="flex justify-center gap-2 px-6">
                {items.map((item, index) => {
                    const isActive = index === activeIndex

                    return (
                        <button
                            key={getKey(item)}
                            type="button"
                            aria-label={`Show item ${index + 1}`}
                            aria-current={isActive ? "true" : undefined}
                            className={cn(
                                "h-2 rounded-full transition-all",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                isActive ? "w-6 bg-foreground" : "w-2 bg-foreground/25"
                            )}
                            onClick={() => scrollToIndex(index)}
                        />
                    )
                })}
            </div>
        </div>
    )
}
