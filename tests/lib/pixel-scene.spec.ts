import { describe, expect, it } from "vitest"

import {
    type CopyRect,
    createPixelScene,
    movePointer,
    pressScene,
    renderPixelScene,
    stepPixelScene
} from "@/components/landing-page/pixel-scene"

const colors = {
    background: [36, 36, 36],
    foreground: [234, 234, 234],
    accent: [60, 110, 235],
    warm: [244, 176, 32]
} as const

const layouts: { name: string; width: number; height: number; copy: CopyRect }[] = [
    {
        name: "phone",
        width: 98,
        height: 190,
        copy: { left: 5, top: 24, right: 93, bottom: 134 }
    },
    {
        name: "desktop",
        width: 384,
        height: 170,
        copy: { left: 115, top: 19, right: 269, bottom: 110 }
    }
]

describe("pixel scene", () => {
    // The hero's text sits on this sky, so a stray pixel is a legibility bug.
    it.each(layouts)("never paints behind the copy or nav on a $name", (layout) => {
        const { width, height, copy } = layout
        const clearTop = 13
        const scene = createPixelScene({
            width,
            height,
            horizon: copy.bottom + (height - copy.bottom) * 0.42,
            copy,
            clearTop,
            colors
        })
        const words = new Uint32Array(scene.pixels.buffer)
        const sky = scene.palette.ramp[0]

        const strayPixels = () => {
            let count = 0
            for (let y = 0; y < copy.bottom; y++) {
                for (let x = 0; x < width; x++) {
                    const inCopy = y >= copy.top && x >= copy.left && x <= copy.right
                    if ((inCopy || y < clearTop) && words[y * width + x] !== sky) count++
                }
            }
            return count
        }

        renderPixelScene(scene)
        expect(strayPixels()).toBe(0)

        for (let frame = 0; frame < 300; frame++) {
            const x = copy.left + ((frame * 3) % (copy.right - copy.left))
            const y = copy.top + ((frame * 2) % (copy.bottom - copy.top))
            movePointer(scene, x, y)
            if (frame % 40 === 0) pressScene(scene, x, y)
            stepPixelScene(scene, 1 / 24)
            renderPixelScene(scene)
            expect(strayPixels()).toBe(0)
        }
    })
})
