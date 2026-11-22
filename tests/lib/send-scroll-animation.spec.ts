import { describe, expect, it } from "vitest"
import {
    SEND_SCROLL_CONFIG,
    createSendScrollAnimation,
    easeOutSendScroll,
    getSendScrollDurationMs,
    resolveSendScrollStartOffset,
    willSubmitComposerMessage
} from "../../src/lib/send-scroll-animation"

describe("send scroll animation", () => {
    it("eases out sharply from 0 to 1 without overshoot", () => {
        expect(easeOutSendScroll(0)).toBe(0)
        expect(easeOutSendScroll(1)).toBe(1)

        const samples = [0.05, 0.15, 0.3, 0.5, 0.75, 0.9, 1].map(easeOutSendScroll)
        for (let i = 1; i < samples.length; i += 1) {
            expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
            expect(samples[i]).toBeLessThanOrEqual(1)
        }

        // Crisp front-loaded launch: already well past halfway at t = 0.25.
        expect(easeOutSendScroll(0.25)).toBeGreaterThan(0.65)
        // Gentle tail: final quarter covers less than 5% of the travel.
        expect(1 - easeOutSendScroll(0.75)).toBeLessThan(0.05)
    })

    it("scales duration by distance within the configured bounds", () => {
        expect(getSendScrollDurationMs(20)).toBe(SEND_SCROLL_CONFIG.minDurationMs)
        expect(getSendScrollDurationMs(250)).toBeGreaterThan(SEND_SCROLL_CONFIG.minDurationMs)
        expect(getSendScrollDurationMs(250)).toBeLessThan(SEND_SCROLL_CONFIG.maxDurationMs)
        expect(getSendScrollDurationMs(2000)).toBe(SEND_SCROLL_CONFIG.maxDurationMs)
    })

    it("jumps across virtualized distance beyond two screens and glides the final screen", () => {
        expect(
            resolveSendScrollStartOffset({
                currentOffset: 1000,
                targetOffset: 1450,
                viewportSize: 800
            })
        ).toBe(1000)

        expect(
            resolveSendScrollStartOffset({
                currentOffset: 400,
                targetOffset: 4000,
                viewportSize: 800
            })
        ).toBe(3200)
    })

    it("absorbs mid-flight target growth and lands on the latest target", () => {
        const animation = createSendScrollAnimation({
            startOffset: 1000,
            initialTargetOffset: 1300,
            startTime: 100
        })

        const early = animation.step({
            time: 100 + animation.durationMs * 0.25,
            targetOffset: 1300
        })
        expect(early.done).toBe(false)
        expect(early.offset).toBeGreaterThan(1180)
        expect(early.offset).toBeLessThan(1300)

        // Content grows mid-flight (e.g. an attachment loads or streaming expands).
        const mid = animation.step({ time: 100 + animation.durationMs * 0.6, targetOffset: 1420 })
        expect(mid.done).toBe(false)
        expect(mid.offset).toBeGreaterThan(early.offset)
        expect(mid.offset).toBeLessThan(1420)

        const landed = animation.step({ time: 100 + animation.durationMs, targetOffset: 1420 })
        expect(landed).toEqual({ offset: 1420, done: true })
    })

    it("detects when composer submission will actually send a new message", () => {
        expect(
            willSubmitComposerMessage({
                composerStatus: "ready",
                inputValue: "Hello",
                fileCount: 0
            })
        ).toBe(true)

        expect(
            willSubmitComposerMessage({
                composerStatus: "ready",
                inputValue: "   ",
                fileCount: 1
            })
        ).toBe(true)

        expect(
            willSubmitComposerMessage({
                composerStatus: "ready",
                inputValue: "   ",
                fileCount: 0
            })
        ).toBe(false)

        expect(
            willSubmitComposerMessage({
                composerStatus: "streaming",
                inputValue: "Hello",
                fileCount: 0
            })
        ).toBe(false)

        expect(
            willSubmitComposerMessage({
                composerStatus: "submitted",
                inputValue: "Hello",
                fileCount: 0
            })
        ).toBe(false)
    })
})
