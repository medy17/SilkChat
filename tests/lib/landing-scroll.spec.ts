import { describe, expect, it } from "vitest"

import {
    landingSceneVisibility,
    landingScrollProgress,
    landingVisualProgress
} from "@/lib/landing-scroll"
import { sculpturePose } from "@/lib/landing-sculpture"

describe("landing scroll geometry", () => {
    it("keeps the braces closed through the handoff and opens them while fully visible", () => {
        const pose = (phase: number) =>
            sculpturePose("source", landingVisualProgress(phase, "after-transition"))
        expect(pose(-0.2)).toEqual(pose(0.15))
        expect(landingSceneVisibility(0.2, 900 / 630).visual).toBe(1)
        expect(pose(0.2).spread).toBeLessThan(0.1)
        expect(pose(0.4).spread).toBeGreaterThan(pose(0.2).spread)
        expect(pose(0.6).spread).toBeGreaterThan(pose(0.4).spread)
        expect(pose(0.65)).toEqual(pose(0.8))
        expect(landingVisualProgress(-2, "after-transition")).toBe(0)
        expect(landingVisualProgress(2, "after-transition")).toBe(1)
    })

    it("never overlaps adjacent compositions and holds both copy and prop for a full reading interval", () => {
        for (const [outgoingHeight, incomingHeight] of [
            [420, 420],
            [420, 640],
            [640, 420],
            [640, 900]
        ]) {
            for (let delta = -200; delta <= 200; delta += 5) {
                const viewport = 900
                const boundary = viewport * 0.25 - delta
                const phase = (top: number, height: number) =>
                    landingScrollProgress({ top, height, viewport, inset: 96, mode: "scene" })
                const outgoing = landingSceneVisibility(
                    phase(boundary - outgoingHeight, outgoingHeight),
                    viewport / outgoingHeight
                )
                const incoming = landingSceneVisibility(
                    phase(boundary, incomingHeight),
                    viewport / incomingHeight
                )
                expect(outgoing.copy).toBe(outgoing.visual)
                expect(incoming.copy).toBe(incoming.visual)
                expect(outgoing.copy * incoming.visual).toBeCloseTo(0)
                expect(incoming.copy * outgoing.visual).toBeCloseTo(0)
            }
        }
        for (const viewport of [667, 900, 1355]) {
            const height = viewport * 1.25
            // A whole viewport of scrolling has a fully visible anchored pair.
            for (let phase = 0.1; phase <= 0.9; phase += 0.01) {
                expect(landingSceneVisibility(phase, viewport / height).copy).toBe(1)
            }
            // Section navigation lands on the readable scene, not a handoff.
            const phase = landingScrollProgress({
                top: 0,
                height,
                viewport,
                inset: 64,
                mode: "scene"
            })
            expect(landingSceneVisibility(phase, viewport / height).copy).toBe(1)
        }
    })

    it("reaches the diagram's assembled stop at screen center and its exit stop after an 8vh hold", () => {
        for (const [viewport, inset, height] of [
            [900, 88, 540],
            [844, 110, 344]
        ]) {
            const progressAtCenter = (fraction: number) =>
                landingScrollProgress({
                    top: viewport * fraction - height / 2,
                    height,
                    viewport,
                    inset,
                    mode: "focus"
                })
            expect(progressAtCenter(1)).toBe(0)
            expect(progressAtCenter(0.9)).toBe(0)
            expect(progressAtCenter(0.7)).toBeCloseTo(0.25)
            expect(progressAtCenter(0.5)).toBeCloseTo(0.5)
            expect(progressAtCenter(0.46)).toBeCloseTo(0.55)
            expect(progressAtCenter(0.42)).toBeCloseTo(0.6)
            expect(progressAtCenter(0.26)).toBeCloseTo(0.8)
            expect(progressAtCenter(0.1)).toBeCloseTo(1)
            expect(progressAtCenter(0)).toBe(1)
        }
    })

    it("starts a full-device hero at its initial pose regardless of navigation height", () => {
        for (const viewport of [667, 844, 1440]) {
            for (const inset of [88, 110]) {
                const scene = { height: viewport, viewport, inset, mode: "hero" as const }
                expect(landingScrollProgress({ ...scene, top: 0 })).toBe(0)
                expect(landingScrollProgress({ ...scene, top: -viewport * 0.375 })).toBe(0.5)
                expect(landingScrollProgress({ ...scene, top: -viewport })).toBe(1)
            }
        }
    })

    it("holds a scene below the navigation and completes when the sticky stage releases", () => {
        const scene = { height: 1500, viewport: 900, inset: 100, mode: "hold" as const }
        expect(landingScrollProgress({ ...scene, top: 100 })).toBe(0)
        expect(landingScrollProgress({ ...scene, top: -250 })).toBe(0.5)
        expect(landingScrollProgress({ ...scene, top: -600 })).toBe(1)
    })

    it("moves progressively on a compact screen without a zero-length sticky interval", () => {
        const scene = { height: 500, viewport: 600, inset: 100, mode: "hold" as const }
        expect(landingScrollProgress({ ...scene, top: 100 })).toBe(0)
        expect(landingScrollProgress({ ...scene, top: 0 })).toBeGreaterThan(0)
        expect(landingScrollProgress({ ...scene, top: 0 })).toBeLessThan(1)
        expect(landingScrollProgress({ ...scene, top: -500 })).toBe(1)
    })

    it("finishes entry motion while content is still in the reading area", () => {
        const scene = { height: 500, viewport: 900, inset: 100, mode: "enter" as const }
        expect(landingScrollProgress({ ...scene, top: 950 })).toBe(0)
        expect(landingScrollProgress({ ...scene, top: 620 })).toBe(0.5)
        expect(landingScrollProgress({ ...scene, top: 340 })).toBe(1)
    })

    it("tracks an unpinned section from its entrance to its exit below the navigation", () => {
        const scene = { height: 500, viewport: 900, inset: 100, mode: "pass" as const }
        expect(landingScrollProgress({ ...scene, top: 900 })).toBe(0)
        expect(landingScrollProgress({ ...scene, top: 250 })).toBe(0.5)
        expect(landingScrollProgress({ ...scene, top: -400 })).toBe(1)
    })

    it("keeps each sculpture steady during the reading interval and clamps overscroll", () => {
        for (const kind of ["conversation", "source"] as const) {
            const interval = kind === "source" ? [0.5, 0.6] : [0.4, 0.7]
            expect(sculpturePose(kind, interval[0])).toEqual(sculpturePose(kind, interval[1]))
            expect(sculpturePose(kind, -1)).toEqual(sculpturePose(kind, 0))
            expect(sculpturePose(kind, 2)).toEqual(sculpturePose(kind, 1))
        }
    })

    it("keeps the braces opening until center, then holds before their exit", () => {
        const centered = sculpturePose("source", 0.5)
        expect(sculpturePose("source", 0.4).spread).toBeLessThan(centered.spread)
        expect(sculpturePose("source", 0.55)).toEqual(centered)
        expect(sculpturePose("source", 0.65).scale).toBeLessThan(centered.scale)
    })
})
