export interface BatchTileRect {
    batchId?: string
    left: number
    top: number
    right: number
    bottom: number
}

type Point = [number, number]

// Trace the union of masonry tile footprints. Shared edges disappear, while
// steps, holes, and disconnected regions retain their actual gallery shape.
export function getMasonryBatchOutlines(
    tiles: BatchTileRect[],
    inset = 1,
    radius = 0,
    verticalInset = inset
) {
    // offsetLeft/offsetWidth round independently in CSS columns. Snap the
    // resulting one-pixel seams so adjacent footprints still share an edge.
    const snapAxis = (values: number[]) => {
        const result = new Map<number, number>()
        let anchor = Number.NEGATIVE_INFINITY
        for (const value of [...new Set(values)].sort((a, b) => a - b)) {
            if (value - anchor > 1) anchor = value
            result.set(value, anchor)
        }
        return result
    }
    const xSnap = snapAxis(tiles.flatMap((tile) => [tile.left, tile.right]))
    const ySnap = snapAxis(tiles.flatMap((tile) => [tile.top, tile.bottom]))
    tiles = tiles.map((tile) => ({
        ...tile,
        left: xSnap.get(tile.left)!,
        right: xSnap.get(tile.right)!,
        top: ySnap.get(tile.top)!,
        bottom: ySnap.get(tile.bottom)!
    }))
    const xs = [...new Set(tiles.flatMap((tile) => [tile.left, tile.right]))].sort((a, b) => a - b)
    const ys = [...new Set(tiles.flatMap((tile) => [tile.top, tile.bottom]))].sort((a, b) => a - b)
    const columns = xs.length - 1
    const rows = ys.length - 1
    if (columns < 1 || rows < 1) return []
    const cells: (string | undefined)[] = new Array(columns * rows)
    for (const tile of tiles) {
        for (let y = ys.indexOf(tile.top); y < ys.indexOf(tile.bottom); y++) {
            for (let x = xs.indexOf(tile.left); x < xs.indexOf(tile.right); x++) {
                cells[y * columns + x] = tile.batchId
            }
        }
    }
    const boundaries = new Map<string, Map<string, Point[]>>()
    const key = ([x, y]: Point) => `${x},${y}`
    const cell = (x: number, y: number) =>
        x < 0 || x >= columns || y < 0 || y >= rows ? undefined : cells[y * columns + x]
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
            const batchId = cell(x, y)
            if (!batchId) continue
            let edges = boundaries.get(batchId)
            if (!edges) {
                edges = new Map()
                boundaries.set(batchId, edges)
            }
            const edge = (from: Point, to: Point) => {
                const destinations = edges.get(key(from)) ?? []
                destinations.push(to)
                edges.set(key(from), destinations)
            }
            if (cell(x, y - 1) !== batchId) edge([x, y], [x + 1, y])
            if (cell(x + 1, y) !== batchId) edge([x + 1, y], [x + 1, y + 1])
            if (cell(x, y + 1) !== batchId) edge([x + 1, y + 1], [x, y + 1])
            if (cell(x - 1, y) !== batchId) edge([x, y + 1], [x, y])
        }
    }
    return [...boundaries].map(([batchId, edges]) => {
        const loops: Point[][] = []
        while (edges.size) {
            const firstKey = edges.keys().next().value as string
            const first = firstKey.split(",").map(Number) as Point
            const points: Point[] = [first]
            let current = first
            do {
                const destinations = edges.get(key(current))!
                // At a corner-touch choose the right turn, keeping separate
                // islands separate instead of joining them diagonally.
                if (destinations.length > 1 && points.length > 1) {
                    const previous = points[points.length - 2]
                    const dx = current[0] - previous[0]
                    const dy = current[1] - previous[1]
                    destinations.sort(
                        (a, b) =>
                            dx * (b[1] - current[1]) -
                            dy * (b[0] - current[0]) -
                            (dx * (a[1] - current[1]) - dy * (a[0] - current[0]))
                    )
                }
                const next = destinations.shift()!
                if (!destinations.length) edges.delete(key(current))
                current = next
                if (key(current) !== firstKey) points.push(current)
            } while (key(current) !== firstKey)
            loops.push(
                points
                    .filter((point, i) => {
                        const prev = points[(i + points.length - 1) % points.length]
                        const next = points[(i + 1) % points.length]
                        return !(
                            (prev[0] === point[0] && point[0] === next[0]) ||
                            (prev[1] === point[1] && point[1] === next[1])
                        )
                    })
                    .map(([x, y]) => [xs[x], ys[y]])
            )
        }
        // Inset the merged contour, leaving clearance between neighbouring
        // batches without separating tiles within the same batch.
        const path = loops
            .map((points) => {
                const contour = points.map(([x, y], i): Point => {
                    const prev = points[(i + points.length - 1) % points.length]
                    const next = points[(i + 1) % points.length]
                    const insetX = -Math.sign(y - prev[1]) - Math.sign(next[1] - y)
                    const insetY = Math.sign(x - prev[0]) + Math.sign(next[0] - x)
                    return [x + insetX * inset, y + insetY * verticalInset]
                })
                return `${contour
                    .map(([x, y], i) => {
                        if (radius <= 0) return `${i ? "L" : "M"}${x} ${y}`
                        const prev = contour[(i + contour.length - 1) % contour.length]
                        const next = contour[(i + 1) % contour.length]
                        // Short steps cap the theme radius to avoid overlapping arcs.
                        const r = Math.min(
                            radius,
                            Math.hypot(x - prev[0], y - prev[1]) / 2,
                            Math.hypot(next[0] - x, next[1] - y) / 2
                        )
                        const dx = Math.sign(x - prev[0])
                        const dy = Math.sign(y - prev[1])
                        const nx = Math.sign(next[0] - x)
                        const ny = Math.sign(next[1] - y)
                        const sweep = dx * ny - dy * nx > 0 ? 1 : 0
                        return `${i ? "L" : "M"}${x - dx * r} ${y - dy * r} A${r} ${r} 0 0 ${sweep} ${x + nx * r} ${y + ny * r}`
                    })
                    .join(" ")} Z`
            })
            .join(" ")
        return { batchId, path }
    })
}

// Anchor to an actual top edge, never the centre of a bounding box that may
// span another batch or an empty masonry column.
export function getBatchLabelPlacement(
    tiles: BatchTileRect[],
    gap: number,
    radius: number,
    offset: number
) {
    if (!tiles.length) return undefined
    const top = Math.min(...tiles.map((tile) => tile.top))
    const edges = tiles
        .filter((tile) => Math.abs(tile.top - top) <= 1)
        .sort((a, b) => a.left - b.left)
    const runs: { left: number; right: number }[] = []
    for (const edge of edges) {
        const last = runs.at(-1)
        if (last && edge.left - last.right <= gap + 1) last.right = Math.max(last.right, edge.right)
        else runs.push({ left: edge.left, right: edge.right })
    }
    const widest = runs.reduce((best, run) =>
        run.right - run.left > best.right - best.left ? run : best
    )
    return {
        x: (widest.left + widest.right) / 2,
        y: top - offset,
        maxWidth: Math.max(0, widest.right - widest.left - radius * 2)
    }
}
