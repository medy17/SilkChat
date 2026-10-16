// Masonry placement for the library grid. Heights come from aspect ratios, so the
// whole layout is computed rather than measured.

export type MasonryBox = { left: number; top: number; width: number; height: number }

// Matches the grid's previous container breakpoints (@2xl, @4xl, @6xl).
export const getMasonryColumnCount = (width: number) => {
    if (width >= 1152) return 5
    if (width >= 896) return 4
    if (width >= 672) return 3
    return 2
}

// Gap in column-width units, used only for column assignment.
const ASSIGNMENT_GAP = 0.05

const toSafeRatio = (ratio: number) => (Number.isFinite(ratio) && ratio > 0 ? ratio : 1)

// Each item joins the shortest column, leftmost on ties. Uses aspect ratios only,
// so an item keeps its column while the grid scales and moves only when the
// column count or the item list changes.
export const assignMasonryColumns = (aspectRatios: number[], columnCount: number) => {
    const heights = new Array<number>(columnCount).fill(0)
    return aspectRatios.map((ratio) => {
        let column = 0
        for (let index = 1; index < columnCount; index++) {
            if (heights[index] < heights[column] - 1e-9) column = index
        }
        heights[column] += 1 / toSafeRatio(ratio) + ASSIGNMENT_GAP
        return column
    })
}

export const layoutMasonry = ({
    aspectRatios,
    columns,
    columnCount,
    width,
    gap
}: {
    aspectRatios: number[]
    columns: number[]
    columnCount: number
    width: number
    gap: number
}): { boxes: MasonryBox[]; height: number } => {
    const columnWidth = Math.max(0, (width - gap * (columnCount - 1)) / columnCount)
    const tops = new Array<number>(columnCount).fill(0)
    const boxes = aspectRatios.map((ratio, index) => {
        const column = columns[index] ?? 0
        const height = columnWidth / toSafeRatio(ratio)
        const box = {
            left: column * (columnWidth + gap),
            top: tops[column],
            width: columnWidth,
            height
        }
        tops[column] += height + gap
        return box
    })
    const tallest = Math.max(0, ...tops)
    return { boxes, height: boxes.length > 0 ? tallest - gap : 0 }
}
