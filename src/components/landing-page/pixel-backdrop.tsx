"use client"

import { useReducedMotion } from "motion/react"
import { type RefObject, useEffect, useRef } from "react"

import {
    type PixelScene,
    type Rgb,
    type SceneColors,
    clearPointer,
    createPixelScene,
    movePointer,
    pressScene,
    renderPixelScene,
    setSceneColors,
    stepPixelScene
} from "@/components/landing-page/pixel-scene"

const FRAME_MS = 1000 / 24
const MAX_STEP_SECONDS = 0.1
const NAV_CLEARANCE_PX = 64
// How far down the scene band the water starts.
const HORIZON_POSITION = 0.42

// Theme tokens can be any CSS color, so a canvas does the parsing.
export function readThemeColors(element: HTMLElement): SceneColors {
    const probe = document.createElement("canvas")
    probe.width = 1
    probe.height = 1
    const context = probe.getContext("2d", { willReadFrequently: true })
    const styles = getComputedStyle(element)

    const read = (token: string, fallback: Rgb): Rgb => {
        const value = styles.getPropertyValue(token).trim()
        if (!context || !value) return fallback
        context.fillStyle = `rgb(${fallback.join(" ")})`
        context.fillStyle = value
        context.fillRect(0, 0, 1, 1)
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
        return [red, green, blue]
    }

    const background = read("--background", [36, 36, 36])
    const foreground = read("--foreground", [234, 234, 234])
    return {
        background,
        foreground,
        accent: read("--chart-2", foreground),
        warm: read("--chart-1", foreground)
    }
}

// Paints from the top of its positioned parent to the bottom of `bandRef`. The
// sky is empty behind `copyRef`, and the scene itself lives in the band. Pointer
// events come from the parent's parent, so everything over the scene stays
// clickable.
export function PixelBackdrop({
    copyRef,
    bandRef
}: {
    copyRef: RefObject<HTMLElement | null>
    bandRef: RefObject<HTMLElement | null>
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const reduced = useReducedMotion() === true

    useEffect(() => {
        const canvas = canvasRef.current
        const copy = copyRef.current
        const band = bandRef.current
        const host = canvas?.parentElement
        const stage = host?.parentElement
        const context = canvas?.getContext("2d")
        if (!canvas || !copy || !band || !host || !stage || !context) return

        let scene: PixelScene | null = null
        let image: ImageData | null = null
        let pixelSize = 5

        const paint = () => {
            if (!scene || !image) return
            renderPixelScene(scene)
            image.data.set(scene.pixels)
            context.putImageData(image, 0, 0)
        }

        const build = () => {
            const { clientWidth } = host
            const sceneBottom = band.offsetTop + band.offsetHeight
            if (clientWidth === 0 || sceneBottom === 0) return
            pixelSize = clientWidth < 768 ? 4 : 5
            const width = Math.ceil(clientWidth / pixelSize)
            const height = Math.ceil(sceneBottom / pixelSize)
            canvas.width = width
            canvas.height = height
            canvas.style.width = `${width * pixelSize}px`
            canvas.style.height = `${height * pixelSize}px`

            // Offsets, not rects: the copy's entrance animation moves its rect.
            scene = createPixelScene({
                width,
                height,
                horizon: (band.offsetTop + band.offsetHeight * HORIZON_POSITION) / pixelSize,
                copy: {
                    left: copy.offsetLeft / pixelSize,
                    top: copy.offsetTop / pixelSize,
                    right: (copy.offsetLeft + copy.offsetWidth) / pixelSize,
                    bottom: (copy.offsetTop + copy.offsetHeight) / pixelSize
                },
                clearTop: NAV_CLEARANCE_PX / pixelSize,
                colors: readThemeColors(canvas)
            })
            image = context.createImageData(width, height)
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
            if (!scene) return
            stepPixelScene(scene, Math.min(elapsed / 1000, MAX_STEP_SECONDS))
            paint()
        }

        const updateLoop = () => {
            cancelAnimationFrame(frame)
            frame = 0
            if (reduced || !onScreen || document.hidden) return
            lastFrame = performance.now()
            frame = requestAnimationFrame(tick)
        }

        let pendingBuild = 0
        const resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(pendingBuild)
            pendingBuild = requestAnimationFrame(build)
        })
        resizeObserver.observe(host)
        resizeObserver.observe(copy)
        resizeObserver.observe(band)

        const themeObserver = new MutationObserver(() => {
            if (!scene) return
            setSceneColors(scene, readThemeColors(canvas))
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

        const toScene = (event: PointerEvent) => {
            const rect = host.getBoundingClientRect()
            return {
                x: (event.clientX - rect.left) / pixelSize,
                y: (event.clientY - rect.top) / pixelSize
            }
        }
        const onPointerMove = (event: PointerEvent) => {
            if (!scene) return
            const { x, y } = toScene(event)
            movePointer(scene, x, y)
        }
        const onPointerDown = (event: PointerEvent) => {
            if (!scene) return
            const { x, y } = toScene(event)
            pressScene(scene, x, y)
        }
        const onPointerGone = () => {
            if (scene) clearPointer(scene)
        }
        const onPointerUp = (event: PointerEvent) => {
            if (event.pointerType === "touch") onPointerGone()
        }

        if (!reduced) {
            stage.addEventListener("pointermove", onPointerMove)
            stage.addEventListener("pointerdown", onPointerDown)
            stage.addEventListener("pointerup", onPointerUp)
            stage.addEventListener("pointerleave", onPointerGone)
            stage.addEventListener("pointercancel", onPointerGone)
        }

        build()
        updateLoop()

        return () => {
            cancelAnimationFrame(frame)
            cancelAnimationFrame(pendingBuild)
            resizeObserver.disconnect()
            themeObserver.disconnect()
            visibilityObserver.disconnect()
            document.removeEventListener("visibilitychange", updateLoop)
            stage.removeEventListener("pointermove", onPointerMove)
            stage.removeEventListener("pointerdown", onPointerDown)
            stage.removeEventListener("pointerup", onPointerUp)
            stage.removeEventListener("pointerleave", onPointerGone)
            stage.removeEventListener("pointercancel", onPointerGone)
        }
    }, [copyRef, bandRef, reduced])

    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <canvas ref={canvasRef} className="block [image-rendering:pixelated]" />
        </div>
    )
}
