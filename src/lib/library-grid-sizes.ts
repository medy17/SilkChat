import { MASONRY_COLUMN_BREAKPOINTS, MASONRY_MIN_COLUMNS } from "@/lib/masonry-layout"

// Geometry the library grid sits in. Keep in sync with the gallery wrapper
// (px-3 sm:px-6), the masonry gap (gap-3 sm:gap-4), the sidebar breakpoint and
// resize limits, and SidebarInset's inset margin (md:m-2, no left margin while
// the sidebar is open).
const SM_VIEWPORT = 640
const MD_VIEWPORT = 768
const GALLERY_PADDING = { base: 12, sm: 24 }
const GRID_GAP = { base: 12, sm: 16 }
const INSET_MARGIN = 8
const MIN_SIDEBAR_WIDTH_PX = 304
const MAX_SIDEBAR_WIDTH_PX = 352
const ROOT_FONT_SIZE_PX = 16

type Region = { minViewport: number; maxViewport: number; offset: number; gap: number }

// The sidebar context stores its width as a CSS length ("19rem" or "320px").
export const parseSidebarWidthPx = (width: string) => {
    const value = Number.parseFloat(width)
    if (!Number.isFinite(value)) return MIN_SIDEBAR_WIDTH_PX
    const px = width.endsWith("rem") ? value * ROOT_FONT_SIZE_PX : value
    return Math.min(MAX_SIDEBAR_WIDTH_PX, Math.max(MIN_SIDEBAR_WIDTH_PX, Math.round(px)))
}

/**
 * Builds the `sizes` attribute for library tiles from the same column breakpoints
 * the masonry layout uses, so the browser sizes srcset candidates against the real
 * column width. `sidebarWidth` is the open desktop sidebar's width in px, or null
 * when it is collapsed. `scrollbarWidth` is the gallery's classic scrollbar, which
 * `100vw` includes but the grid does not.
 */
export const getLibraryGridSizes = ({
    sidebarWidth,
    scrollbarWidth = 0
}: {
    sidebarWidth: number | null
    scrollbarWidth?: number
}) => {
    const desktopChrome = sidebarWidth === null ? INSET_MARGIN * 2 : sidebarWidth + INSET_MARGIN
    const regions: Region[] = [
        {
            minViewport: MD_VIEWPORT,
            maxViewport: Number.POSITIVE_INFINITY,
            offset: desktopChrome + GALLERY_PADDING.sm * 2 + scrollbarWidth,
            gap: GRID_GAP.sm
        },
        {
            minViewport: SM_VIEWPORT,
            maxViewport: MD_VIEWPORT - 1,
            offset: GALLERY_PADDING.sm * 2 + scrollbarWidth,
            gap: GRID_GAP.sm
        },
        {
            minViewport: 0,
            maxViewport: SM_VIEWPORT - 1,
            offset: GALLERY_PADDING.base * 2 + scrollbarWidth,
            gap: GRID_GAP.base
        }
    ]

    const entries: string[] = []
    for (const region of regions) {
        const columnSteps = [
            ...MASONRY_COLUMN_BREAKPOINTS,
            { minWidth: Number.NEGATIVE_INFINITY, columns: MASONRY_MIN_COLUMNS }
        ]
        for (const { minWidth, columns } of columnSteps) {
            const minViewport = Math.max(minWidth + region.offset, region.minViewport)
            if (minViewport > region.maxViewport) continue

            const subtracted = region.offset + region.gap * (columns - 1)
            const width = `calc((100vw - ${subtracted}px) / ${columns})`
            entries.push(minViewport > 0 ? `(min-width: ${minViewport}px) ${width}` : width)
            // This step already covers the rest of the region.
            if (minViewport === region.minViewport) break
        }
    }

    return entries.join(", ")
}

// Used before the sidebar state is known: the default open sidebar, no scrollbar.
export const DEFAULT_LIBRARY_GRID_SIZES = getLibraryGridSizes({
    sidebarWidth: MIN_SIDEBAR_WIDTH_PX
})
