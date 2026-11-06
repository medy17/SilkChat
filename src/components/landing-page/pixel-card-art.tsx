"use client"

import { useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

import { readThemeColors } from "@/components/landing-page/pixel-backdrop"
import { type CardPainter, createEdgeMask } from "@/components/landing-page/pixel-card-scenes"
import { type Palette, buildPalette } from "@/components/landing-page/pixel-scene"

const FRAME_MS = 1000 / 12
const MAX_STEP_SECONDS = 0.25
// Reduced motion gets one frame from the middle of the action.
const STILL_TIME = 4
// Whole CSS pixels per scene pixel, sized so a card stays about this many wide.
const SCENE_WIDTH = 76

// Fills its positioned parent with a painter's scene, and only runs on screen.
export function PixelCardArt({ createPainter }: { createPainter: () => CardPainter }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const reduced = useReducedMotion() === true

    useEffect(() => {
        const canvas = canvasRef.current
        const host = canvas?.parentElement
        const context = canvas?.getContext("2d")
        if (!canvas || !host || !context) return

        const painter = createPainter()
        let palette: Palette = buildPalette(readThemeColors(canvas))
        let image: ImageData | null = null
        let words = new Uint32Array(0)
        let edgeMask = new Uint8Array(0)
        let time = reduced ? STILL_TIME : 0

        const paint = () => {
            if (!image) return
            painter({ words, width: image.width, height: image.height, time, palette })
            for (let index = 0; index < words.length; index++) {
                if (edgeMask[index] === 0) words[index] = 0
            }
            context.putImageData(image, 0, 0)
        }

        const build = () => {
            const { clientWidth, clientHeight } = host
            if (clientWidth === 0 || clientHeight === 0) return
            const cell = Math.max(3, Math.round(clientWidth / SCENE_WIDTH))
            const width = Math.ceil(clientWidth / cell)
            const height = Math.ceil(clientHeight / cell)
            canvas.width = width
            canvas.height = height
            canvas.style.width = `${width * cell}px`
            canvas.style.height = `${height * cell}px`
            image = context.createImageData(width, height)
            words = new Uint32Array(image.data.buffer)
            edgeMask = createEdgeMask(width, height)
            paint()
        }

        let frame = 0
        let lastFrame = 0
        let onScreen = true

        const tick = (now: number) => {
            frame = requestAnimationFrame(tick)
            const elapsed = now - lastFrame
            if (elapsed < FRAME_MS) return
            lastFrame = now
            time += Math.min(elapsed / 1000, MAX_STEP_SECONDS)
            paint()
        }

        const updateLoop = () => {
            cancelAnimationFrame(frame)
            frame = 0
            if (reduced || !onScreen || document.hidden) return
            lastFrame = performance.now()
            frame = requestAnimationFrame(tick)
        }

        const resizeObserver = new ResizeObserver(build)
        resizeObserver.observe(host)

        const themeObserver = new MutationObserver(() => {
            palette = buildPalette(readThemeColors(canvas))
            paint()
        })
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"]
        })

        const visibilityObserver = new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? false
            updateLoop()
        })
        visibilityObserver.observe(host)
        document.addEventListener("visibilitychange", updateLoop)

        build()
        updateLoop()

        return () => {
            cancelAnimationFrame(frame)
            resizeObserver.disconnect()
            themeObserver.disconnect()
            visibilityObserver.disconnect()
            document.removeEventListener("visibilitychange", updateLoop)
        }
    }, [createPainter, reduced])

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 block [image-rendering:pixelated]"
        />
    )
}
