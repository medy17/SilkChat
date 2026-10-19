// The expand control appears once a draft is long enough to feel cramped.
export const COMPOSER_EXPAND_MIN_LINES = 3

const EXPANDED_COMPOSER_GAP_PX = 16

// Which edge stays put as the composer grows: a docked composer keeps its bottom edge, a
// composer at the top of a scrolling column keeps its top, and a centered one fills the
// column with equal gaps.
export type ComposerExpandAnchor = "bottom" | "top" | "center"

export const getExpandedComposerHeight = ({
    anchor,
    top,
    bottom,
    viewportHeight,
    headerHeight
}: {
    anchor: ComposerExpandAnchor
    top: number
    bottom: number
    viewportHeight: number
    headerHeight: number
}) => {
    const gap = EXPANDED_COMPOSER_GAP_PX
    const start = anchor === "top" ? top : headerHeight + gap
    const end = anchor === "bottom" ? bottom : viewportHeight - gap
    return Math.max(0, Math.round(end - start))
}

// Reads a length custom property such as `4rem` or `64px` from the root element.
export const readRootLengthPx = (property: string) => {
    const root = document.documentElement
    const value = getComputedStyle(root).getPropertyValue(property).trim()
    const amount = Number.parseFloat(value)
    if (!Number.isFinite(amount)) return 0
    return value.endsWith("rem")
        ? amount * Number.parseFloat(getComputedStyle(root).fontSize)
        : amount
}
