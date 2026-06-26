import * as React from "react"

// A device is treated as "touch" only when its primary pointer is coarse and
// cannot hover. This is independent of viewport width, so a zoomed-in desktop
// browser (narrow CSS width but still mouse-driven) is NOT misclassified.
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)"

export function useIsTouchDevice() {
    const [isTouch, setIsTouch] = React.useState<boolean | undefined>(undefined)

    React.useEffect(() => {
        const mql = window.matchMedia(TOUCH_QUERY)
        const onChange = () => {
            setIsTouch(mql.matches)
        }
        mql.addEventListener("change", onChange)
        setIsTouch(mql.matches)
        return () => mql.removeEventListener("change", onChange)
    }, [])

    return !!isTouch
}
