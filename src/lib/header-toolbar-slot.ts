import { create } from "zustand"

// The app header's glass bar exposes a slot that the active page can portal its
// toolbar into, so page controls and the account cluster share one surface.
// The page also decides when the header slides away while its content scrolls.
type HeaderToolbarSlotStore = {
    element: HTMLElement | null
    isHidden: boolean
    setElement: (element: HTMLElement | null) => void
    setHidden: (isHidden: boolean) => void
}

export const useHeaderToolbarSlotStore = create<HeaderToolbarSlotStore>()((set) => ({
    element: null,
    isHidden: false,
    setElement: (element) => set({ element }),
    setHidden: (isHidden) => set({ isHidden })
}))
