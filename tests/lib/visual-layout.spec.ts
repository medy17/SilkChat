import { solveVisualLayout, VISUAL_LAYOUT_GAP } from "@/lib/visual-layout"
import { describe, expect, it } from "vitest"

const shape = (rows: ReturnType<typeof solveVisualLayout>) =>
    rows.map((row) => row.map((tile) => tile.index))

const rowWidth = (row: ReturnType<typeof solveVisualLayout>[number]) =>
    row.reduce((sum, tile) => sum + tile.width, VISUAL_LAYOUT_GAP * (row.length - 1))

describe("visual reference layout", () => {
    it("never crops: every tile keeps its image's aspect ratio", () => {
        const galleries = [[16 / 9, 2 / 3, 5], [1, 0.4], [8], [0.3, 0.3, 0.3]]
        for (const ratios of galleries) {
            for (const width of [320, 680]) {
                for (const tile of solveVisualLayout(ratios, width).flat()) {
                    expect(tile.width / tile.height).toBeCloseTo(ratios[tile.index], 6)
                }
            }
        }
    })

    it("keeps similar landscapes on one full-width row", () => {
        const rows = solveVisualLayout([4 / 3, 3 / 2, 4 / 3], 680)
        expect(shape(rows)).toEqual([[0, 1, 2]])
        expect(rowWidth(rows[0])).toBeCloseTo(680, 6)
    })

    it("gives a panorama its own row instead of shrinking its neighbours", () => {
        expect(shape(solveVisualLayout([5, 2 / 3, 2 / 3], 680))).toEqual([[0], [1, 2]])
    })

    it("caps tall rows and centres them rather than cropping", () => {
        const [row] = solveVisualLayout([2 / 3], 680)
        expect(row[0].height).toBe(320)
        expect(row[0].width).toBeCloseTo(320 * (2 / 3), 6)
    })

    it("wraps into a lead image and a pair on narrow screens", () => {
        expect(shape(solveVisualLayout([4 / 3, 4 / 3, 4 / 3], 360))).toEqual([[0], [1, 2]])
    })
})
