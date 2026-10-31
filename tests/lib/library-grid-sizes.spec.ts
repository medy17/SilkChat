import { describe, expect, it } from "vitest"
import { getLibraryGridSizes, parseSidebarWidthPx } from "@/lib/library-grid-sizes"
import { getMasonryColumnCount } from "@/lib/masonry-layout"

// Resolves a `sizes` value the way a browser does: first matching media condition wins.
const resolveSizes = (sizes: string, viewport: number) => {
    for (const entry of sizes.split(", ")) {
        const match = /^(?:\(min-width: (\d+)px\) )?calc\(\(100vw - (\d+)px\) \/ (\d+)\)$/.exec(
            entry
        )
        if (!match) throw new Error(`Unparseable sizes entry: ${entry}`)
        const [, minViewport, subtracted, columns] = match
        if (minViewport === undefined || viewport >= Number(minViewport)) {
            return (viewport - Number(subtracted)) / Number(columns)
        }
    }
    throw new Error("No sizes entry matched")
}

// The grid's real column width, mirroring the layout the sizes string describes.
const actualTileWidth = (viewport: number, sidebarWidth: number | null, scrollbarWidth: number) => {
    const isDesktop = viewport >= 768
    const isSm = viewport >= 640
    const chrome = isDesktop ? (sidebarWidth === null ? 16 : sidebarWidth + 8) : 0
    const container = viewport - chrome - scrollbarWidth - (isSm ? 48 : 24)
    const gap = isSm ? 16 : 12
    const columns = getMasonryColumnCount(container)
    return (container - gap * (columns - 1)) / columns
}

describe("library grid sizes", () => {
    it.each([
        ["open", 304, 0],
        ["widened", 352, 0],
        ["collapsed", null, 0],
        ["open with a classic scrollbar", 304, 15],
        ["collapsed with a classic scrollbar", null, 15]
    ] as const)(
        "matches the masonry column width with the sidebar %s",
        (_, sidebarWidth, scrollbarWidth) => {
            const sizes = getLibraryGridSizes({ sidebarWidth, scrollbarWidth })
            for (let viewport = 320; viewport <= 3840; viewport += 1) {
                expect(resolveSizes(sizes, viewport)).toBeCloseTo(
                    actualTileWidth(viewport, sidebarWidth, scrollbarWidth),
                    5
                )
            }
        }
    )

    it("ends with an unconditional fallback for the narrowest screens", () => {
        expect(getLibraryGridSizes({ sidebarWidth: 304 }).split(", ").at(-1)).toBe(
            "calc((100vw - 36px) / 2)"
        )
    })

    it("reads the sidebar's stored width within its resize limits", () => {
        expect(["19rem", "20.5rem", "330px", "12rem", "30rem"].map(parseSidebarWidthPx)).toEqual([
            304, 328, 330, 304, 352
        ])
    })
})
