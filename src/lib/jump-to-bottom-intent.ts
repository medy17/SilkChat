// Decides when Scroll to bottom is worth showing. A scroll counts as heading down only after
// real downward travel, and the pill stays away when the reader will reach the end on their
// own. Once shown it holds until the bottom, a deliberate scroll up, or the scroll stopping,
// so it never flickers at a line in the sand.
export const JUMP_TO_BOTTOM_INTENT = {
    // Downward travel, as a share of the visible height, before a scroll reads as heading down.
    headingDownFraction: 0.25,
    // Upward travel that ends a downward run. Smaller wobbles, like a trackpad settling, don't.
    reverseTolerancePx: 32,
    // Within this share of a screen of the end, the bottom is already in reach.
    nearBottomFraction: 0.5,
    // At the current pace, arriving sooner than this needs no shortcut.
    minArrivalMs: 800,
    // Same as the list's own bottom check.
    atBottomPx: 4
} as const

export type JumpToBottomSample = {
    offset: number
    distanceFromBottom: number
    viewportSize: number
    // Milliseconds, from any monotonic clock.
    time: number
}

const VELOCITY_SMOOTHING = 0.4

export const createJumpToBottomIntent = (config = JUMP_TO_BOTTOM_INTENT) => {
    let lastOffset: number | null = null
    let lastTime = 0
    let downTravel = 0
    let upTravel = 0
    // Downward pace in px/ms, smoothed so one uneven frame doesn't decide.
    let velocity = 0
    let visible = false

    const endRun = () => {
        downTravel = 0
        upTravel = 0
        velocity = 0
        visible = false
        return visible
    }

    // Feeds one scroll position. Returns whether the pill should show.
    const sample = ({ offset, distanceFromBottom, viewportSize, time }: JumpToBottomSample) => {
        const previousOffset = lastOffset
        const elapsed = Math.max(1, time - lastTime)
        lastOffset = offset
        lastTime = time

        if (distanceFromBottom <= config.atBottomPx) return endRun()
        if (previousOffset === null) return visible

        const delta = offset - previousOffset
        if (delta < 0) {
            upTravel -= delta
            return upTravel > config.reverseTolerancePx ? endRun() : visible
        }
        if (delta === 0) return visible

        downTravel += delta
        upTravel = 0
        const pace = delta / elapsed
        velocity = velocity === 0 ? pace : velocity + (pace - velocity) * VELOCITY_SMOOTHING

        if (!visible) {
            const isHeadingDown = downTravel >= viewportSize * config.headingDownFraction
            const isFarFromBottom = distanceFromBottom > viewportSize * config.nearBottomFraction
            const arrivalMs = distanceFromBottom / velocity
            visible = isHeadingDown && isFarFromBottom && arrivalMs >= config.minArrivalMs
        }
        return visible
    }

    // Scrolling stopped: the run is over, and the next one has to show intent again.
    const idle = endRun

    // A new thread, or a jump the reader didn't make.
    const reset = () => {
        lastOffset = null
        return endRun()
    }

    return { sample, idle, reset }
}
