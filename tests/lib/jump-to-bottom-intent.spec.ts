import { describe, expect, it } from "vitest"
import { createJumpToBottomIntent } from "../../src/lib/jump-to-bottom-intent"

const VIEWPORT = 800
const CONTENT = 10_000
const MAX_OFFSET = CONTENT - VIEWPORT

// Scrolls from `from` to `to` in frame-sized steps at `pxPerMs`, returning each answer.
const scroll = (
    intent: ReturnType<typeof createJumpToBottomIntent>,
    from: number,
    to: number,
    pxPerMs: number,
    startTime = 0
) => {
    const step = Math.sign(to - from) * pxPerMs * 16
    const answers: boolean[] = []
    let offset = from
    let time = startTime
    const sample = () =>
        answers.push(
            intent.sample({
                offset,
                distanceFromBottom: MAX_OFFSET - offset,
                viewportSize: VIEWPORT,
                time
            })
        )
    sample()
    while (offset !== to) {
        offset = step > 0 ? Math.min(to, offset + step) : Math.max(to, offset + step)
        time += 16
        sample()
    }
    return { answers, time }
}

describe("jump to bottom intent", () => {
    it("ignores a small nudge down", () => {
        const intent = createJumpToBottomIntent()
        expect(scroll(intent, 1000, 1100, 0.5).answers).not.toContain(true)
    })

    it("shows for a steady scroll down from far up", () => {
        const intent = createJumpToBottomIntent()
        expect(scroll(intent, 1000, 1400, 0.5).answers.at(-1)).toBe(true)
    })

    it("stays away when the reader will reach the end on their own", () => {
        const fast = createJumpToBottomIntent()
        expect(scroll(fast, MAX_OFFSET - 2400, MAX_OFFSET, 4).answers).not.toContain(true)

        const close = createJumpToBottomIntent()
        expect(scroll(close, MAX_OFFSET - 600, MAX_OFFSET - 100, 0.3).answers).not.toContain(true)
    })

    it("once shown, holds through the last stretch and leaves at the bottom", () => {
        const intent = createJumpToBottomIntent()
        const { answers } = scroll(intent, 1000, MAX_OFFSET, 0.5)
        const firstShown = answers.indexOf(true)
        expect(firstShown).toBeGreaterThan(0)
        expect(answers.slice(firstShown, -1).every(Boolean)).toBe(true)
        expect(answers.at(-1)).toBe(false)
    })

    it("rides out a small wobble up but ends on a real scroll up", () => {
        const intent = createJumpToBottomIntent()
        const run = scroll(intent, 1000, 1400, 0.5)
        expect(scroll(intent, 1400, 1380, 0.5, run.time).answers.at(-1)).toBe(true)
        expect(scroll(intent, 1380, 1200, 0.5, run.time + 100).answers.at(-1)).toBe(false)
    })

    it("needs fresh intent after scrolling stops", () => {
        const intent = createJumpToBottomIntent()
        const run = scroll(intent, 1000, 1400, 0.5)
        expect(intent.idle()).toBe(false)
        expect(scroll(intent, 1400, 1450, 0.5, run.time + 3000).answers).not.toContain(true)
    })
})
