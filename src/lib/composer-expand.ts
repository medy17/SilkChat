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

// Ref callback for a docked composer. The thread reads this height to keep its scroll room
// in step with the composer, so a tall draft never covers the end of the conversation.
// An expanded composer takes over the column, so the thread keeps its last docked height.
export const publishComposerHeight = (composer: HTMLElement | null) => {
    const column = composer?.closest<HTMLElement>("[data-chat-column]")
    if (!composer || !column) return

    const observer = new ResizeObserver(([entry]) => {
        if (composer.querySelector("[data-composer-expanded]")) return
        const height = entry.borderBoxSize[0].blockSize
        column.style.setProperty("--chat-composer-height", `${height}px`)
    })
    observer.observe(composer)

    return () => {
        observer.disconnect()
        column.style.removeProperty("--chat-composer-height")
    }
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
