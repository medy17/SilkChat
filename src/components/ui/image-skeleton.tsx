"use client"

import { type ComponentProps, useEffect, useMemo, useRef, useState } from "react"

type DotData = {
    row: number
    col: number
    speed: number
    offset: number
}

type ImageSkeletonProps = {
    rows?: number
    cols?: number
    dotSize?: number
    gap?: number
    imageUrl?: string
    loadingDuration?: number
    autoLoop?: boolean
} & ComponentProps<"div">

const REVEAL_DURATION_MS = 800
const LOOP_RESET_DELAY_MS = 3000

function createDots(rows: number, cols: number): DotData[] {
    return Array.from({ length: rows * cols }, (_, index) => ({
        row: Math.floor(index / cols),
        col: index % cols,
        speed: 0.001 + Math.random() * 0.002,
        offset: Math.random() * Math.PI * 2
    }))
}

export const ImageSkeleton = ({
    rows = 15,
    cols = 25,
    dotSize = 0,
    gap = 6,
    imageUrl = "/placeholder.svg?height=400&width=600",
    loadingDuration = 3000,
    autoLoop = true,
    className = "",
    ...props
}: ImageSkeletonProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const themeColorRef = useRef("rgb(59 130 246)")

    const [showImage, setShowImage] = useState(false)
    const [isShimmering, setIsShimmering] = useState(true)
    const [animationKey, setAnimationKey] = useState(0)

    const dots = useMemo(() => createDots(rows, cols), [rows, cols])

    useEffect(() => {
        let isMounted = true
        let revealTimer: number | undefined
        let loopTimer: number | undefined

        if (loadingDuration === 99999) {
            setIsShimmering(true)
            setShowImage(false)
            return () => {
                isMounted = false
            }
        }

        setShowImage(false)
        setIsShimmering(true)

        revealTimer = window.setTimeout(() => {
            if (!isMounted) return

            setIsShimmering(false)
            setShowImage(true)

            if (autoLoop) {
                loopTimer = window.setTimeout(() => {
                    if (isMounted) {
                        setAnimationKey((prev) => prev + 1)
                    }
                }, LOOP_RESET_DELAY_MS)
            }
        }, loadingDuration)

        return () => {
            isMounted = false
            if (revealTimer !== undefined) {
                window.clearTimeout(revealTimer)
            }
            if (loopTimer !== undefined) {
                window.clearTimeout(loopTimer)
            }
        }
    }, [animationKey, loadingDuration, autoLoop])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const updateThemeColor = () => {
            const computedStyle = window.getComputedStyle(container)
            const primaryColor = computedStyle.getPropertyValue("--primary").trim()

            if (primaryColor && CSS.supports("color", primaryColor)) {
                themeColorRef.current = primaryColor
                return
            }

            const resolvedColor = computedStyle.color
            if (resolvedColor) {
                themeColorRef.current = resolvedColor
            }
        }

        updateThemeColor()

        const root = document.documentElement
        const observer = new MutationObserver(updateThemeColor)
        observer.observe(root, {
            attributes: true,
            attributeFilter: ["class", "data-theme", "style"]
        })

        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        const context = canvas.getContext("2d")
        if (!context) return

        let animationFrameId = 0
        let fadeAlpha = 1

        const render = (time: number) => {
            const rect = canvas.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            const targetWidth = Math.max(1, Math.floor(rect.width * dpr))
            const targetHeight = Math.max(1, Math.floor(rect.height * dpr))

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth
                canvas.height = targetHeight
            }

            fadeAlpha = isShimmering
                ? Math.min(1, fadeAlpha + 0.05)
                : Math.max(0, fadeAlpha - 0.05)

            context.clearRect(0, 0, canvas.width, canvas.height)

            if (fadeAlpha > 0) {
                const cellWidth = canvas.width / cols
                const cellHeight = canvas.height / rows
                const actualGap = gap * dpr
                const baseDotSize =
                    dotSize > 0
                        ? Math.min(dotSize * dpr, Math.max(cellWidth - actualGap, 1), Math.max(cellHeight - actualGap, 1))
                        : Math.max(Math.min(cellWidth, cellHeight) - actualGap, 1)

                context.fillStyle = themeColorRef.current

                for (const dot of dots) {
                    const phase = time * dot.speed + dot.offset
                    const pulse = (Math.sin(phase) + 1) / 2
                    context.globalAlpha = (0.18 + pulse * 0.62) * fadeAlpha

                    const x = dot.col * cellWidth + (cellWidth - baseDotSize) / 2
                    const y = dot.row * cellHeight + (cellHeight - baseDotSize) / 2

                    context.fillRect(x, y, baseDotSize, baseDotSize)
                }

                context.globalAlpha = 1
            }

            if (!isShimmering && fadeAlpha <= 0) {
                return
            }

            animationFrameId = window.requestAnimationFrame(render)
        }

        animationFrameId = window.requestAnimationFrame(render)

        return () => {
            window.cancelAnimationFrame(animationFrameId)
        }
    }, [rows, cols, dots, isShimmering, gap, dotSize])

    return (
        <div
            ref={containerRef}
            {...props}
            className={`relative h-full w-full overflow-hidden rounded-lg border border-border/50 bg-muted/10 ${className}`}
        >
            <style>{`
                @keyframes image-skeleton-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .image-skeleton-reveal {
                    animation: image-skeleton-fade-in ${REVEAL_DURATION_MS}ms ease-out forwards;
                }
            `}</style>

            <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            />

            {showImage && (
                <img
                    key={animationKey}
                    src={imageUrl}
                    alt="Loaded content"
                    className="image-skeleton-reveal absolute inset-0 z-10 h-full w-full object-cover"
                />
            )}
        </div>
    )
}
