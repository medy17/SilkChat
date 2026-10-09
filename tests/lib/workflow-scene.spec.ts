import { describe, expect, it } from "vitest"

import { workflowScenePhase } from "@/lib/workflow-scene"

// Scroll progress runs from the scene's top entering at the viewport bottom
// (0) to its bottom leaving at the viewport top (1).
const progressWhenTopAt = (topPx: number, viewport: number, scene: number) =>
    (viewport - topPx) / (viewport + scene)

describe("workflowScenePhase", () => {
    const viewport = 1350
    const scene = 640

    it("reaches phase 0 when the scene top crosses the viewport center by default", () => {
        const progress = progressWhenTopAt(viewport / 2, viewport, scene)
        expect(workflowScenePhase(progress, viewport / scene)).toBeCloseTo(0)
    })

    it("centers the phase on a sticky stage that sits above the viewport center", () => {
        // A stage pinned at 96px and 640px tall has its center at 416px.
        const anchor = 416 / viewport
        const progress = progressWhenTopAt(416 - scene / 2, viewport, scene)
        expect(workflowScenePhase(progress, viewport / scene, anchor)).toBeCloseTo(0.5)
    })
})
