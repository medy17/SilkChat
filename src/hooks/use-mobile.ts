import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(MOBILE_QUERY)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
}

// The same query it subscribes to, so the value and its change events never disagree (they
// could under fractional zoom with innerWidth) and it matches the CSS breakpoints.
const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches

const getServerSnapshot = () => false

// Read synchronously, so a phone's first render is already the mobile layout. Reading it in
// an effect rendered every consumer's desktop branch for one frame first, which showed up as
// the header's actions opening and collapsing again after a reload.
export function useIsMobile() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
