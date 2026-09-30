// Justified layout for visual reference galleries. Reference images are information, so
// tiles always keep the image's own aspect ratio: rows adapt instead of pixels being cropped.
// (Cropping an over-wide image to a legible height loses exactly the share that showing it
// whole would shrink it by, so a crop never scores better than the whole image.)

export type VisualLayoutTile = { index: number; width: number; height: number }
export type VisualLayoutRow = VisualLayoutTile[]

export const VISUAL_LAYOUT_GAP = 8
export const VISUAL_LAYOUT_FALLBACK_RATIO = 4 / 3
const MAX_ROW_HEIGHT = 320
const MIN_TILE_EDGE = 120
const EXTRA_ROW_COST = 0.2
const SMALL_TILE_WEIGHT = 1.5

// Every contiguous split of the images into rows, in reading order. Bit i of the mask breaks
// the row after image i. Earlier splits win ties, so a lone lead image beats a lone last one.
const rowSplits = (count: number) =>
    Array.from({ length: 2 ** (count - 1) }, (_, mask) => {
        const rows: number[][] = [[0]]
        for (let index = 1; index < count; index++) {
            if (mask & (1 << (index - 1))) rows.push([index])
            else rows[rows.length - 1].push(index)
        }
        return rows
    })

const layoutRow = (indices: number[], ratios: readonly number[], width: number) => {
    const gaps = VISUAL_LAYOUT_GAP * (indices.length - 1)
    const naturalHeight = (width - gaps) / indices.reduce((sum, index) => sum + ratios[index], 0)
    // Rows too tall for the chat are capped and centred rather than cropped.
    const height = Math.min(naturalHeight, MAX_ROW_HEIGHT)
    const tiles = indices.map((index) => ({ index, width: height * ratios[index], height }))
    const usedWidth = tiles.reduce((sum, tile) => sum + tile.width, gaps)
    const smallness = tiles.reduce(
        (sum, tile) =>
            sum + Math.max(0, (MIN_TILE_EDGE - Math.min(tile.width, tile.height)) / MIN_TILE_EDGE),
        0
    )
    return { tiles, cost: 1 - usedWidth / width + smallness * SMALL_TILE_WEIGHT }
}

export const solveVisualLayout = (ratios: readonly number[], width: number): VisualLayoutRow[] => {
    if (ratios.length === 0 || width <= 0) return []

    let best: { rows: VisualLayoutRow[]; cost: number } | undefined
    for (const split of rowSplits(ratios.length)) {
        const rows = split.map((indices) => layoutRow(indices, ratios, width))
        const cost =
            rows.reduce((sum, row) => sum + row.cost, 0) + EXTRA_ROW_COST * (rows.length - 1)
        if (!best || cost < best.cost) best = { rows: rows.map((row) => row.tiles), cost }
    }
    return best?.rows ?? []
}
