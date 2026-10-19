export const SELECTION_TOOLBAR_HEIGHT_PX = 32
const SELECTION_TOOLBAR_MARGIN_PX = 8
const SELECTION_TOOLBAR_GAP_PX = 12

export type SelectionToolbarPosition = {
    x: number
    y: number
    placement: "above" | "below"
}

type Rect = Pick<DOMRect, "top" | "bottom" | "left" | "width">

// Centers a floating control on a selection, clamped inside the viewport, above the
// selection unless only the space below fits it.
export const getSelectionToolbarPosition = (
    rect: Rect,
    width: number,
    viewport: { width: number; height: number }
): SelectionToolbarPosition => {
    const clearance =
        SELECTION_TOOLBAR_HEIGHT_PX + SELECTION_TOOLBAR_MARGIN_PX + SELECTION_TOOLBAR_GAP_PX
    const half = width / 2
    const x = Math.min(
        Math.max(rect.left + rect.width / 2, SELECTION_TOOLBAR_MARGIN_PX + half),
        viewport.width - SELECTION_TOOLBAR_MARGIN_PX - half
    )
    const hasRoomAbove = rect.top >= clearance
    const hasRoomBelow = viewport.height - rect.bottom >= clearance
    const placement = hasRoomAbove || !hasRoomBelow ? "above" : "below"
    return {
        x,
        y:
            placement === "above"
                ? rect.top - SELECTION_TOOLBAR_GAP_PX
                : rect.bottom + SELECTION_TOOLBAR_GAP_PX,
        placement
    }
}
