import { useSyncExternalStore } from "react"

// A device is treated as "touch" only when its primary pointer is coarse and
// cannot hover. This is independent of viewport width, so a zoomed-in desktop
// browser (narrow CSS width but still mouse-driven) is NOT misclassified.
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)"

let touchMediaQuery: MediaQueryList | null = null
const touchSubscribers = new Set<() => void>()

const getTouchMediaQuery = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return null
    }

    touchMediaQuery ??= window.matchMedia(TOUCH_QUERY)
    return touchMediaQuery
}

const subscribeToTouchChanges = (subscriber: () => void) => {
    const mediaQuery = getTouchMediaQuery()
    touchSubscribers.add(subscriber)

    if (mediaQuery && touchSubscribers.size === 1) {
        mediaQuery.addEventListener("change", notifyTouchSubscribers)
    }

    return () => {
        touchSubscribers.delete(subscriber)
        if (mediaQuery && touchSubscribers.size === 0) {
            mediaQuery.removeEventListener("change", notifyTouchSubscribers)
        }
    }
}

function notifyTouchSubscribers() {
    for (const subscriber of touchSubscribers) {
        subscriber()
    }
}

const getTouchSnapshot = () => getTouchMediaQuery()?.matches ?? false
const getServerTouchSnapshot = () => false

export function useIsTouchDevice() {
    return useSyncExternalStore(
        subscribeToTouchChanges,
        getTouchSnapshot,
        getServerTouchSnapshot
    )
}
