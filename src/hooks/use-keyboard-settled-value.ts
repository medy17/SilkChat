import { useEffect, useState } from "react"

// Quiet time after the last viewport resize before the keyboard counts as settled.
export const KEYBOARD_RESIZE_SETTLE_MS = 80
// Longest wait for a resize that may never come, e.g. with a hardware keyboard.
export const KEYBOARD_RESIZE_WAIT_MS = 450

// Holds back changes to `value` until the on-screen keyboard has finished resizing the
// viewport. Focus changes open or close the keyboard, which moves the page after React has
// committed, so layout animations started in between measure positions that are already
// stale. When disabled, `value` passes straight through.
export function useKeyboardSettledValue<T>(value: T, enabled: boolean): T {
    const [settled, setSettled] = useState(value)

    useEffect(() => {
        if (!enabled) {
            setSettled(value)
            return
        }
        const viewport = window.visualViewport ?? window
        const commit = () => setSettled(value)
        let timer = window.setTimeout(commit, KEYBOARD_RESIZE_WAIT_MS)
        const onResize = () => {
            window.clearTimeout(timer)
            timer = window.setTimeout(commit, KEYBOARD_RESIZE_SETTLE_MS)
        }
        viewport.addEventListener("resize", onResize)
        return () => {
            window.clearTimeout(timer)
            viewport.removeEventListener("resize", onResize)
        }
    }, [value, enabled])

    return enabled ? settled : value
}
