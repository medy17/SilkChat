import { describe, expect, it } from "vitest"
import { getSendHandoffFrame } from "../../src/lib/send-handoff"

const composerText = { left: 300, top: 800, width: 240, height: 24 }
const bubble = { left: 520, top: 420, width: 180, height: 44 }

const frameAt = (progress: number) =>
    getSendHandoffFrame({ from: composerText, to: bubble, progress, startTextScale: 0.875 })

describe("send handoff frame", () => {
    it("opens undeformed on the composer text, with no bubble surface yet", () => {
        const frame = frameAt(0)
        expect(frame).toMatchObject({ ...composerText, scaleX: 1, scaleY: 1, textScale: 0.875 })
        expect(frame.surfaceOpacity).toBe(0)
    })

    it("stretches along an upward flight, then squashes as it lands", () => {
        const flight = frameAt(0.15)
        expect(flight.scaleY).toBeGreaterThan(1.05)
        expect(flight.scaleX).toBeLessThan(1)

        const landing = frameAt(0.8)
        expect(landing.scaleY).toBeLessThan(1)
        expect(landing.scaleX).toBeGreaterThan(1)
    })

    it("lands exactly on the bubble, fully formed", () => {
        expect(frameAt(1)).toEqual({
            ...bubble,
            scaleX: 1,
            scaleY: 1,
            surfaceOpacity: 1,
            textScale: 1
        })
    })
})
