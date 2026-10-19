// @vitest-environment jsdom

import {
    KEYBOARD_RESIZE_SETTLE_MS,
    KEYBOARD_RESIZE_WAIT_MS,
    useKeyboardSettledValue
} from "@/hooks/use-keyboard-settled-value"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const renderSettledValue = (enabled: boolean) =>
    renderHook(({ value }) => useKeyboardSettledValue(value, enabled), {
        initialProps: { value: false }
    })

const advance = (ms: number) =>
    act(() => {
        vi.advanceTimersByTime(ms)
    })

describe("useKeyboardSettledValue", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("holds a change until the keyboard's viewport resizes stop", () => {
        const { result, rerender } = renderSettledValue(true)

        rerender({ value: true })
        advance(100)
        act(() => {
            window.dispatchEvent(new Event("resize"))
        })
        advance(KEYBOARD_RESIZE_SETTLE_MS - 1)
        act(() => {
            window.dispatchEvent(new Event("resize"))
        })
        advance(KEYBOARD_RESIZE_SETTLE_MS - 1)
        expect(result.current).toBe(false)

        advance(1)
        expect(result.current).toBe(true)
    })

    it("applies the change when no keyboard resize arrives", () => {
        const { result, rerender } = renderSettledValue(true)

        rerender({ value: true })
        advance(KEYBOARD_RESIZE_WAIT_MS - 1)
        expect(result.current).toBe(false)

        advance(1)
        expect(result.current).toBe(true)
    })

    it("passes changes straight through when disabled", () => {
        const { result, rerender } = renderSettledValue(false)

        rerender({ value: true })

        expect(result.current).toBe(true)
    })
})
