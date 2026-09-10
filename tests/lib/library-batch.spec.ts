import { describe, expect, it } from "vitest"
import { getBatchLabelPlacement, getMasonryBatchOutlines } from "@/lib/masonry-batch-outline"

describe("masonry batch outlines", () => {
    it("anchors the label on the widest continuous top edge, excluding empty columns and lower tiles", () => {
        expect(
            getBatchLabelPlacement(
                [
                    { left: 0, right: 100, top: 10, bottom: 100 },
                    { left: 120, right: 220, top: 10, bottom: 160 },
                    { left: 440, right: 540, top: 10, bottom: 160 },
                    { left: 0, right: 540, top: 180, bottom: 280 }
                ],
                20,
                12,
                5
            )
        ).toEqual({ x: 110, y: 5, maxWidth: 196 })
    })

    it("reserves label room vertically without changing the inner gutter", () => {
        const [{ path }] = getMasonryBatchOutlines(
            [
                { batchId: "0:a", left: -10, right: 110, top: -20, bottom: 120 },
                { batchId: "0:a", left: -10, right: 110, top: 120, bottom: 260 }
            ],
            5,
            0,
            15
        )
        expect(path).toBe("M-5 -5 L105 -5 L105 245 L-5 245 Z")
    })

    it("rounds outside corners and inward steps, capping the radius on short edges", () => {
        const [{ path }] = getMasonryBatchOutlines(
            [
                { batchId: "0:a", left: 0, top: 0, right: 100, bottom: 100 },
                { batchId: "0:a", left: 100, top: 0, right: 200, bottom: 60 }
            ],
            5,
            100
        )
        expect(path).toContain("M5 50 A45 45 0 0 1 50 5")
        expect(path).toContain("L115 55 A20 20 0 0 0 95 75")
        expect(path.match(/ A/g)).toHaveLength(6)
    })

    it("traces a stepped masonry footprint without the shared tile border", () => {
        const outlines = getMasonryBatchOutlines([
            { batchId: "0:a", left: 0, top: 0, right: 100, bottom: 100 },
            { batchId: "0:a", left: 100, top: 0, right: 200, bottom: 60 }
        ])
        expect(outlines).toEqual([
            { batchId: "0:a", path: "M1 1 L199 1 L199 59 L99 59 L99 99 L1 99 Z" }
        ])
    })

    it("closes fractional-column rounding seams between neighbouring tiles", () => {
        const outlines = getMasonryBatchOutlines([
            { batchId: "0:a", left: 0, top: 0, right: 100, bottom: 100 },
            { batchId: "0:a", left: 101, top: 0, right: 201, bottom: 100 }
        ])
        expect(outlines[0].path).toBe("M1 1 L200 1 L200 99 L1 99 Z")
    })

    it("preserves holes occupied by another batch and keeps repeated colours distinct", () => {
        const outlines = getMasonryBatchOutlines([
            { batchId: "0:a", left: 0, top: 0, right: 300, bottom: 100 },
            { batchId: "0:a", left: 0, top: 100, right: 100, bottom: 200 },
            { batchId: "0:a", left: 200, top: 100, right: 300, bottom: 200 },
            { batchId: "0:a", left: 0, top: 200, right: 300, bottom: 300 },
            { batchId: "0:b", left: 100, top: 100, right: 200, bottom: 200 }
        ])
        expect(outlines).toHaveLength(2)
        expect(outlines.find((item) => item.batchId === "0:a")!.path.match(/Z/g)).toHaveLength(2)
        expect(outlines.find((item) => item.batchId === "0:b")!.path).toBe(
            "M101 101 L199 101 L199 199 L101 199 Z"
        )
    })

    it("does not connect diagonal or separated tiles through unrelated images", () => {
        const outlines = getMasonryBatchOutlines([
            { batchId: "0:a", left: 0, top: 0, right: 100, bottom: 100 },
            { left: 100, top: 0, right: 200, bottom: 100 },
            { batchId: "0:a", left: 100, top: 100, right: 200, bottom: 200 }
        ])
        expect(outlines).toHaveLength(1)
        expect(outlines[0].path.match(/Z/g)).toHaveLength(2)
        expect(getMasonryBatchOutlines([])).toEqual([])
    })
})
