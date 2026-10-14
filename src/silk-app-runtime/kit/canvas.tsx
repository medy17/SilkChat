import { SILK_APP_THEME_COLORS } from "@/lib/silk-app/protocol"
import { cn } from "@/lib/utils"
import { type ComponentProps, useEffect, useRef, useState } from "react"

// Info is the frame's own alias (see frame.css); the rest come from the host.
const THEME_COLOR_NAMES = [...SILK_APP_THEME_COLORS, "info"] as const

export type ThemeColors = Record<(typeof THEME_COLOR_NAMES)[number], string> & {
    dark: boolean
}

// Canvas and WebGL can't read CSS variables, and theme values may be oklch(), which
// Three.js doesn't parse. A 1×1 canvas resolves any CSS color to rgb().
let probe: CanvasRenderingContext2D | null = null
const toRgb = (color: string) => {
    probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    if (!probe || !color) return color
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = "#000"
    probe.fillStyle = color
    probe.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

const readThemeColors = (): ThemeColors => {
    const styles = getComputedStyle(document.documentElement)
    const colors = Object.fromEntries(
        THEME_COLOR_NAMES.map((name) => [name, toRgb(styles.getPropertyValue(`--${name}`).trim())])
    ) as Record<(typeof THEME_COLOR_NAMES)[number], string>
    return { ...colors, dark: document.documentElement.classList.contains("dark") }
}

/** Theme colors as rgb() strings for canvas, SVG, and Three.js; updates with the theme. */
export function useThemeColors() {
    const [colors, setColors] = useState(readThemeColors)

    useEffect(() => {
        const observer = new MutationObserver(() => setColors(readThemeColors()))
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"]
        })
        return () => observer.disconnect()
    }, [])

    return colors
}

export type CanvasFrame = {
    width: number
    height: number
    /** Seconds since the canvas mounted. */
    time: number
    /** Seconds since the previous frame, capped so a background tab doesn't jump. */
    delta: number
}

/**
 * A canvas sized to its box at device pixel ratio. `draw` receives a context already
 * scaled to CSS pixels; `animate` redraws every frame instead of only on resize.
 */
export function Canvas({
    draw,
    animate = false,
    height = 320,
    className,
    style,
    ...props
}: {
    draw: (context: CanvasRenderingContext2D, frame: CanvasFrame) => void
    animate?: boolean
    height?: number
    className?: string
} & Omit<ComponentProps<"canvas">, "height" | "width">) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawRef = useRef(draw)
    const paintRef = useRef<((now: number) => void) | null>(null)

    useEffect(() => {
        drawRef.current = draw
    })

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext("2d")
        if (!canvas || !context) return

        let width = 0
        let boxHeight = 0
        let frameId = 0
        const start = performance.now()
        let previous = start

        const paint = (now: number) => {
            const delta = Math.min((now - previous) / 1000, 0.1)
            previous = now
            context.setTransform(1, 0, 0, 1, 0, 0)
            context.clearRect(0, 0, canvas.width, canvas.height)
            const ratio = window.devicePixelRatio || 1
            context.setTransform(ratio, 0, 0, ratio, 0, 0)
            drawRef.current(context, {
                width,
                height: boxHeight,
                time: (now - start) / 1000,
                delta
            })
        }

        const resize = () => {
            const bounds = canvas.getBoundingClientRect()
            const ratio = window.devicePixelRatio || 1
            width = bounds.width
            boxHeight = bounds.height
            canvas.width = Math.max(1, Math.round(width * ratio))
            canvas.height = Math.max(1, Math.round(boxHeight * ratio))
            if (!animate) paint(performance.now())
        }

        const loop = (now: number) => {
            paint(now)
            frameId = requestAnimationFrame(loop)
        }

        const observer = new ResizeObserver(resize)
        observer.observe(canvas)
        resize()
        paintRef.current = paint
        if (animate) frameId = requestAnimationFrame(loop)

        return () => {
            observer.disconnect()
            cancelAnimationFrame(frameId)
            paintRef.current = null
        }
    }, [animate])

    // A static canvas repaints when its drawing changes.
    useEffect(() => {
        if (!animate) paintRef.current?.(performance.now())
    })

    return (
        <canvas
            ref={canvasRef}
            // The box sets the size; the bitmap follows it, so the layout never feeds back.
            className={cn("block w-full", className)}
            style={{ height, ...style }}
            {...props}
        />
    )
}
