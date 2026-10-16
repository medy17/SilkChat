import { describe, expect, it } from "vitest"
import { assignMasonryColumns, getMasonryColumnCount, layoutMasonry } from "@/lib/masonry-layout"

describe("masonry layout", () => {
    it("picks the column count from the grid width", () => {
        expect([500, 672, 896, 1152, 1600].map(getMasonryColumnCount)).toEqual([2, 3, 4, 5, 5])
    })

    it("fills the shortest column, leftmost on ties", () => {
        // Portrait items are twice as tall as squares.
        expect(assignMasonryColumns([0.5, 1, 1, 1], 2)).toEqual([0, 1, 1, 0])
    })

    it("keeps every item in its column while the grid scales", () => {
        const aspectRatios = [0.75, 1.78, 1, 0.56, 1.33, 1, 0.75, 2.33]
        const columns = assignMasonryColumns(aspectRatios, 3)
        const narrow = layoutMasonry({ aspectRatios, columns, columnCount: 3, width: 700, gap: 16 })
        const wide = layoutMasonry({ aspectRatios, columns, columnCount: 3, width: 880, gap: 16 })

        const columnOf = (left: number, width: number) => Math.round(left / (width + 16))
        expect(narrow.boxes.map((box) => columnOf(box.left, box.width))).toEqual(columns)
        expect(wide.boxes.map((box) => columnOf(box.left, box.width))).toEqual(columns)
    })

    it("stacks boxes from aspect ratios and reports the tallest column", () => {
        const { boxes, height } = layoutMasonry({
            aspectRatios: [1, 2, 0.5],
            columns: [0, 1, 1],
            columnCount: 2,
            width: 210,
            gap: 10
        })

        expect(boxes).toEqual([
            { left: 0, top: 0, width: 100, height: 100 },
            { left: 110, top: 0, width: 100, height: 50 },
            { left: 110, top: 60, width: 100, height: 200 }
        ])
        expect(height).toBe(260)
    })
})
