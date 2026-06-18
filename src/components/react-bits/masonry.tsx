"use client"

import { gsap } from "gsap"
import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import "./masonry.css"

type MasonryItem = {
    id: string
    img: string
    url?: string
    width?: number
    height: number
    columns?: number
    label?: string
}

type GridItem = MasonryItem & {
    x: number
    y: number
    w: number
    h: number
}

type MasonryProps = {
    items: MasonryItem[]
    ease?: string
    duration?: number
    stagger?: number
    animateFrom?: "bottom" | "top" | "left" | "right" | "center" | "random"
    scaleOnHover?: boolean
    hoverScale?: number
    blurToFocus?: boolean
    colorShiftOnHover?: boolean
    onItemClick?: (item: MasonryItem) => void
}

const useMedia = (queries: string[], values: number[], defaultValue: number): number => {
    const get = useCallback(() => {
        if (typeof window === "undefined") {
            return defaultValue
        }

        const index = queries.findIndex((query) => window.matchMedia(query).matches)
        return values[index] ?? defaultValue
    }, [defaultValue, queries, values])

    const [value, setValue] = useState<number>(get)

    useEffect(() => {
        const handler = () => setValue(get)
        const mediaQueries = queries.map((query) => window.matchMedia(query))

        mediaQueries.forEach((query) => query.addEventListener("change", handler))
        return () => mediaQueries.forEach((query) => query.removeEventListener("change", handler))
    }, [get, queries])

    return value
}

const useMeasure = <T extends HTMLElement>() => {
    const ref = useRef<T | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    useLayoutEffect(() => {
        if (!ref.current) {
            return
        }

        const resizeObserver = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            setSize({ width, height })
        })

        resizeObserver.observe(ref.current)
        return () => resizeObserver.disconnect()
    }, [])

    return [ref, size] as const
}

const preloadImages = async (urls: string[]): Promise<void> => {
    await Promise.all(
        urls.map(
            (src) =>
                new Promise<void>((resolve) => {
                    const img = new Image()
                    img.src = src
                    img.onload = img.onerror = () => resolve()
                })
        )
    )
}

export function Masonry({
    items,
    ease = "power3.out",
    duration = 0.6,
    stagger = 0.05,
    animateFrom = "bottom",
    scaleOnHover = true,
    hoverScale = 0.95,
    blurToFocus = true,
    colorShiftOnHover = false,
    onItemClick
}: MasonryProps) {
    const queries = useMemo(
        () => [
            "(min-width:1500px)",
            "(min-width:1000px)",
            "(min-width:600px)",
            "(min-width:400px)"
        ],
        []
    )
    const columnValues = useMemo(() => [5, 4, 3, 2], [])
    const columns = useMedia(queries, columnValues, 1)
    const [containerRef, { width }] = useMeasure<HTMLDivElement>()
    const [imagesReady, setImagesReady] = useState(false)
    const [hasEnteredView, setHasEnteredView] = useState(false)
    const hasMounted = useRef(false)

    const getInitialPosition = useCallback(
        (item: GridItem) => {
            const containerRect = containerRef.current?.getBoundingClientRect()

            if (!containerRect) {
                return { x: item.x, y: item.y }
            }

            let direction = animateFrom

            if (animateFrom === "random") {
                const directions = ["top", "bottom", "left", "right"] as const
                direction = directions[Math.floor(Math.random() * directions.length)]
            }

            switch (direction) {
                case "top":
                    return { x: item.x, y: -200 }
                case "bottom":
                    return { x: item.x, y: window.innerHeight + 200 }
                case "left":
                    return { x: -200, y: item.y }
                case "right":
                    return { x: window.innerWidth + 200, y: item.y }
                case "center":
                    return {
                        x: containerRect.width / 2 - item.w / 2,
                        y: containerRect.height / 2 - item.h / 2
                    }
                default:
                    return { x: item.x, y: item.y + 100 }
            }
        },
        [animateFrom, containerRef]
    )

    useEffect(() => {
        setImagesReady(false)
        preloadImages(items.map((item) => item.img)).then(() => setImagesReady(true))
    }, [items])

    // Defer the entrance animation until the grid first scrolls into view, so the
    // slide-up plays for the user instead of finishing off-screen on mount.
    useEffect(() => {
        const node = containerRef.current

        if (!node) {
            return
        }

        if (typeof IntersectionObserver === "undefined") {
            setHasEnteredView(true)
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setHasEnteredView(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.15 }
        )

        observer.observe(node)
        return () => observer.disconnect()
    }, [containerRef])

    const grid = useMemo<GridItem[]>(() => {
        if (!width) {
            return []
        }

        const colHeights = new Array(columns).fill(0)
        const columnWidth = width / columns

        return items.map((child) => {
            const columnSpan = Math.min(child.columns ?? 1, columns)
            const availableColumnCount = columns - columnSpan + 1
            const columnGroups = Array.from({ length: availableColumnCount }, (_, index) => {
                const groupHeights = colHeights.slice(index, index + columnSpan)
                return {
                    index,
                    y: Math.max(...groupHeights)
                }
            })
            const { index: col, y } = columnGroups.reduce((best, group) =>
                group.y < best.y ? group : best
            )
            const x = columnWidth * col
            const itemWidth = columnWidth * columnSpan
            const height = child.width ? itemWidth * (child.height / child.width) : child.height / 2

            for (let index = col; index < col + columnSpan; index += 1) {
                colHeights[index] = y + height
            }

            return { ...child, x, y, w: itemWidth, h: height }
        })
    }, [columns, items, width])

    const containerHeight = useMemo(
        () => grid.reduce((max, item) => Math.max(max, item.y + item.h), 0),
        [grid]
    )

    useLayoutEffect(() => {
        if (!imagesReady) {
            return
        }

        // Hold the items hidden until the grid enters the viewport; otherwise the
        // entrance would animate (and settle) while still scrolled out of sight.
        if (!hasMounted.current && !hasEnteredView) {
            return
        }

        grid.forEach((item, index) => {
            const selector = `[data-masonry-key="${item.id}"]`
            const animationProps = {
                x: item.x,
                y: item.y,
                width: item.w,
                height: item.h
            }

            if (!hasMounted.current) {
                const initialPos = getInitialPosition(item)
                const initialState = {
                    opacity: 0,
                    x: initialPos.x,
                    y: initialPos.y,
                    width: item.w,
                    height: item.h,
                    ...(blurToFocus && { filter: "blur(10px)" })
                }

                gsap.fromTo(selector, initialState, {
                    opacity: 1,
                    ...animationProps,
                    ...(blurToFocus && { filter: "blur(0px)" }),
                    duration: 0.8,
                    ease: "power3.out",
                    delay: index * stagger
                })
            } else {
                gsap.to(selector, {
                    ...animationProps,
                    duration,
                    ease,
                    overwrite: "auto"
                })
            }
        })

        hasMounted.current = true
    }, [
        grid,
        imagesReady,
        hasEnteredView,
        stagger,
        getInitialPosition,
        blurToFocus,
        duration,
        ease
    ])

    const handleMouseEnter = (event: React.MouseEvent, item: GridItem) => {
        const selector = `[data-masonry-key="${item.id}"]`

        if (scaleOnHover) {
            gsap.to(selector, {
                scale: hoverScale,
                duration: 0.3,
                ease: "power2.out"
            })
        }

        if (colorShiftOnHover) {
            const overlay = event.currentTarget.querySelector(".react-bits-masonry-color-overlay")

            if (overlay) {
                gsap.to(overlay, {
                    opacity: 0.3,
                    duration: 0.3
                })
            }
        }
    }

    const handleMouseLeave = (event: React.MouseEvent, item: GridItem) => {
        const selector = `[data-masonry-key="${item.id}"]`

        if (scaleOnHover) {
            gsap.to(selector, {
                scale: 1,
                duration: 0.3,
                ease: "power2.out"
            })
        }

        if (colorShiftOnHover) {
            const overlay = event.currentTarget.querySelector(".react-bits-masonry-color-overlay")

            if (overlay) {
                gsap.to(overlay, {
                    opacity: 0,
                    duration: 0.3
                })
            }
        }
    }

    return (
        <div
            ref={containerRef}
            className="react-bits-masonry"
            style={{ height: containerHeight || undefined }}
        >
            {grid.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    data-masonry-key={item.id}
                    className="react-bits-masonry-item"
                    onClick={() => {
                        if (onItemClick) {
                            onItemClick(item)
                            return
                        }

                        if (item.url) {
                            window.open(item.url, "_blank", "noopener")
                        }
                    }}
                    onMouseEnter={(event) => handleMouseEnter(event, item)}
                    onMouseLeave={(event) => handleMouseLeave(event, item)}
                >
                    <span
                        className="react-bits-masonry-image block"
                        style={{ backgroundImage: `url(${item.img})` }}
                    >
                        {colorShiftOnHover ? (
                            <span className="react-bits-masonry-color-overlay" />
                        ) : null}
                    </span>
                </button>
            ))}
        </div>
    )
}

export default Masonry
