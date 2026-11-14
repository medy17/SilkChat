"use client"

import { type ComponentProps, useEffect, useRef, useState } from "react"

type ImageSkeletonProps = {
    /** Dot width in CSS pixels. */
    dotSize?: number
    /** Distance between dot centers in CSS pixels, the same on both axes. */
    pitch?: number
    imageUrl?: string
    loadingDuration?: number
    autoLoop?: boolean
} & ComponentProps<"div">

const REVEAL_DURATION_MS = 800
const LOOP_RESET_DELAY_MS = 3000
const MAX_DOTS = 10000
// How far the cursor lights dots, in CSS pixels, and how long they take to fade
// once it has moved on.
const POINTER_REACH_PX = 72
const POINTER_TRAIL_MS = 220
// The lit area bulges like a lens: dots are pushed away from the cursor by up to
// this many CSS pixels, and take this long to catch up with it.
const POINTER_BULGE_PX = 8
const POINTER_BULGE_LAG_MS = 70

// A stable 0..1 value per dot, so a dot keeps its rhythm when the grid is rebuilt.
const dotNoise = (row: number, col: number, seed: number) => {
    const value = Math.sin(row * 127.1 + col * 311.7 + seed) * 43758.5453
    return value - Math.floor(value)
}

export const ImageSkeleton = ({
    dotSize = 3,
    pitch = 10,
    imageUrl = "/placeholder.svg?height=400&width=600",
    loadingDuration = 3000,
    autoLoop = true,
    className = "",
    ...props
}: ImageSkeletonProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    // Dots take the primary color. Near the cursor they pick up the chart colors.
    const themeColorsRef = useRef({
        dot: "rgb(59 130 246)",
        core: "rgb(59 130 246)",
        halo: "rgb(59 130 246)"
    })

    const [showImage, setShowImage] = useState(false)
    const [isShimmering, setIsShimmering] = useState(true)
    const [animationKey, setAnimationKey] = useState(0)

    // Each skeleton shimmers in its own pattern.
    const [seed] = useState(() => Math.random() * 1000)

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
            const readColor = (name: string) => {
                const value = computedStyle.getPropertyValue(name).trim()
                return value && CSS.supports("color", value) ? value : null
            }

            const dot = readColor("--primary") || computedStyle.color || themeColorsRef.current.dot
            themeColorsRef.current = {
                dot,
                core: readColor("--chart-1") ?? dot,
                halo: readColor("--chart-2") ?? dot
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
        let lastTime = 0
        let grid = {
            rows: 0,
            cols: 0,
            speeds: new Float32Array(0),
            offsets: new Float32Array(0),
            // How lit each dot is by the cursor, 0..1.
            energy: new Float32Array(0),
            // How far each dot is pushed off its place, in canvas pixels.
            shiftX: new Float32Array(0),
            shiftY: new Float32Array(0),
            glowing: false
        }

        // Tracked on the window because the canvas sits under other layers and takes
        // no pointer events. Touch is left out: a finger on a tile is scrolling.
        const pointer = { x: 0, y: 0, active: false }
        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerType === "touch") return
            pointer.x = event.clientX
            pointer.y = event.clientY
            pointer.active = true
        }
        const handlePointerGone = () => {
            pointer.active = false
        }
        const followsPointer = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (followsPointer) {
            window.addEventListener("pointermove", handlePointerMove, { passive: true })
            window.addEventListener("blur", handlePointerGone)
            document.documentElement.addEventListener("pointerleave", handlePointerGone)
        }

        const render = (time: number) => {
            const rect = canvas.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            const targetWidth = Math.max(1, Math.floor(rect.width * dpr))
            const targetHeight = Math.max(1, Math.floor(rect.height * dpr))

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth
                canvas.height = targetHeight
            }

            fadeAlpha = isShimmering ? Math.min(1, fadeAlpha + 0.05) : Math.max(0, fadeAlpha - 0.05)

            context.clearRect(0, 0, canvas.width, canvas.height)

            if (fadeAlpha > 0) {
                // The grid is laid out from the element's own size at a fixed pitch, so
                // every skeleton has the same dot density whatever its shape. Only a
                // surface too large for the dot budget spaces its dots further apart.
                const safePitch = Math.max(pitch, 1)
                const step =
                    Math.max(safePitch, Math.sqrt((rect.width * rect.height) / MAX_DOTS)) * dpr
                const cols = Math.max(1, Math.floor(canvas.width / step))
                const rows = Math.max(1, Math.floor(canvas.height / step))
                const size = Math.max(1, Math.round(Math.min(dotSize, safePitch) * dpr))

                if (grid.rows !== rows || grid.cols !== cols) {
                    const speeds = new Float32Array(rows * cols)
                    const offsets = new Float32Array(rows * cols)
                    for (let row = 0; row < rows; row++) {
                        for (let col = 0; col < cols; col++) {
                            const index = row * cols + col
                            speeds[index] = 0.001 + dotNoise(row, col, seed) * 0.002
                            offsets[index] = dotNoise(row, col, seed + 500) * Math.PI * 2
                        }
                    }
                    grid = {
                        rows,
                        cols,
                        speeds,
                        offsets,
                        energy: new Float32Array(rows * cols),
                        shiftX: new Float32Array(rows * cols),
                        shiftY: new Float32Array(rows * cols),
                        glowing: false
                    }
                }

                const elapsed = Math.min(100, time - lastTime)
                lastTime = time
                const fade = Math.exp(-elapsed / POINTER_TRAIL_MS)
                // Dots chase the cursor quickly and settle back at the pace of the trail.
                const chase = 1 - Math.exp(-elapsed / POINTER_BULGE_LAG_MS)
                const settle = 1 - fade
                const reach = POINTER_REACH_PX * dpr
                // The push is zero at the cursor and at the rim and peaks a third of
                // the way out, where it reaches POINTER_BULGE_PX.
                const bulge = (POINTER_BULGE_PX * dpr * 6.75) / reach
                const pointerX = (pointer.x - rect.left) * dpr
                const pointerY = (pointer.y - rect.top) * dpr
                const pointerNear =
                    pointer.active &&
                    pointerX > -reach &&
                    pointerX < canvas.width + reach &&
                    pointerY > -reach &&
                    pointerY < canvas.height + reach
                // Skips the per-dot work while the cursor is away and nothing is fading.
                const lit = pointerNear || grid.glowing
                let glowing = false

                // Centered, so the leftover space is split evenly between both edges.
                const originX = (canvas.width - cols * step) / 2 + (step - size) / 2
                const originY = (canvas.height - rows * step) / 2 + (step - size) / 2

                const colors = themeColorsRef.current
                context.fillStyle = colors.dot

                for (let row = 0; row < rows; row++) {
                    const y = Math.round(originY + row * step)
                    for (let col = 0; col < cols; col++) {
                        const index = row * cols + col
                        const x = Math.round(originX + col * step)
                        const phase = time * grid.speeds[index] + grid.offsets[index]
                        const pulse = (Math.sin(phase) + 1) / 2
                        const shimmer = 0.18 + pulse * 0.62

                        let energy = 0
                        let shiftX = 0
                        let shiftY = 0
                        if (lit) {
                            energy = grid.energy[index] * fade
                            let pushX = 0
                            let pushY = 0
                            let ease = settle
                            if (pointerNear) {
                                const awayX = x + size / 2 - pointerX
                                const awayY = y + size / 2 - pointerY
                                const distance = Math.hypot(awayX, awayY)
                                if (distance < reach) {
                                    const closeness = 1 - distance / reach
                                    const strength = closeness * closeness
                                    energy = Math.max(energy, strength)
                                    pushX = awayX * strength * bulge
                                    pushY = awayY * strength * bulge
                                    ease = chase
                                }
                            }
                            shiftX = grid.shiftX[index]
                            shiftY = grid.shiftY[index]
                            shiftX += (pushX - shiftX) * ease
                            shiftY += (pushY - shiftY) * ease
                            if (energy < 0.004) energy = 0
                            if (energy > 0 || Math.abs(shiftX) + Math.abs(shiftY) > 0.05) {
                                glowing = true
                            } else {
                                shiftX = 0
                                shiftY = 0
                            }
                            grid.energy[index] = energy
                            grid.shiftX[index] = shiftX
                            grid.shiftY[index] = shiftY
                        }

                        // A lit dot grows by up to a pixel a side. A pushed dot sits
                        // between pixels, so it moves smoothly instead of in steps.
                        const grow = Math.round(energy * dpr)
                        const left = x + shiftX - grow
                        const top = y + shiftY - grow
                        const side = size + grow * 2
                        context.globalAlpha = shimmer * fadeAlpha
                        context.fillRect(left, top, side, side)

                        if (energy > 0) {
                            // Color is painted over the dot: a wide halo in one chart
                            // color and a tight core in the other. The halo falls off
                            // more slowly, so it is also what lingers in the trail.
                            context.fillStyle = colors.halo
                            context.globalAlpha = Math.sqrt(energy) * fadeAlpha
                            context.fillRect(left, top, side, side)
                            context.fillStyle = colors.core
                            context.globalAlpha = energy * fadeAlpha
                            context.fillRect(left, top, side, side)
                            context.fillStyle = colors.dot
                        }
                    }
                }

                grid.glowing = glowing

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
            window.removeEventListener("pointermove", handlePointerMove)
            window.removeEventListener("blur", handlePointerGone)
            document.documentElement.removeEventListener("pointerleave", handlePointerGone)
        }
    }, [isShimmering, pitch, dotSize, seed])

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
