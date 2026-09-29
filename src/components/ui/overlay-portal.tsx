import { createContext, useContext } from "react"

// Retained Radix overlays must stay inside their containing React Aria focus scope.
export const OverlayPortalContext = createContext<HTMLElement | null>(null)
export function useOverlayPortalContainer() {
    return useContext(OverlayPortalContext) ?? undefined
}
