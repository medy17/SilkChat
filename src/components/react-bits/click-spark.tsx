"use client"

// Adapted from ReactBits ClickSpark: https://reactbits.dev/animations/click-spark
// Uses on-demand frames, theme colors, and reduced-motion support.
import { type ReactNode, useEffect, useRef } from "react"

type Spark = { x: number; y: number; angle: number; startTime: number }

export default function ClickSpark({
    sparkColor = "var(--foreground)",
    sparkSize = 10,
    sparkRadius = 15,
    sparkCount = 8,
    duration = 400,
    children
}: {
    sparkColor?: string
    sparkSize?: number
    sparkRadius?: number
    sparkCount?: number
    duration?: number
    children: ReactNode
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const container = containerRef.current
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!container || !canvas || !ctx) return

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
        let sparks: Spark[] = []
        let animationId = 0
        let color = ""

        const resize = () => {
            const { width, height } = canvas.getBoundingClientRect()
            const ratio = window.devicePixelRatio || 1
            canvas.width = Math.round(width * ratio)
            canvas.height = Math.round(height * ratio)
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        }
        const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height)
        const stop = () => {
            cancelAnimationFrame(animationId)
            animationId = 0
            sparks = []
            clear()
        }
        const draw = (timestamp: number) => {
            clear()
            sparks = sparks.filter((spark) => {
                const elapsed = timestamp - spark.startTime
                if (elapsed >= duration) return false
                const progress = elapsed / duration
                const eased = progress * (2 - progress)
                const distance = eased * sparkRadius
                const length = sparkSize * (1 - eased)
                const cos = Math.cos(spark.angle)
                const sin = Math.sin(spark.angle)
                ctx.strokeStyle = color
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(spark.x + distance * cos, spark.y + distance * sin)
                ctx.lineTo(spark.x + (distance + length) * cos, spark.y + (distance + length) * sin)
                ctx.stroke()
                return true
            })
            animationId = sparks.length ? requestAnimationFrame(draw) : 0
        }
        const click = (event: MouseEvent) => {
            if (reducedMotion.matches || duration <= 0) return
            const rect = canvas.getBoundingClientRect()
            const target = event.target instanceof Element ? event.target.closest("button") : null
            const buttonRect = target?.getBoundingClientRect()
            const x =
                event.detail === 0 && buttonRect
                    ? buttonRect.left + buttonRect.width / 2 - rect.left
                    : event.clientX - rect.left
            const y =
                event.detail === 0 && buttonRect
                    ? buttonRect.top + buttonRect.height / 2 - rect.top
                    : event.clientY - rect.top
            color = getComputedStyle(canvas).color
            const startTime = performance.now()
            sparks.push(
                ...Array.from({ length: sparkCount }, (_, index) => ({
                    x,
                    y,
                    angle: (2 * Math.PI * index) / sparkCount,
                    startTime
                }))
            )
            if (!animationId) animationId = requestAnimationFrame(draw)
        }

        const observer = new ResizeObserver(resize)
        observer.observe(container)
        resize()
        container.addEventListener("click", click)
        reducedMotion.addEventListener("change", stop)
        return () => {
            stop()
            observer.disconnect()
            container.removeEventListener("click", click)
            reducedMotion.removeEventListener("change", stop)
        }
    }, [sparkSize, sparkRadius, sparkCount, duration])

    return (
        <div ref={containerRef} className="relative w-full">
            {children}
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none absolute -inset-8 z-10 h-[calc(100%+4rem)] w-[calc(100%+4rem)]"
                style={{ color: sparkColor }}
            />
        </div>
    )
}
