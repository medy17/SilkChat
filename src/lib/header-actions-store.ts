import { create } from "zustand"
import { persist } from "zustand/middleware"

export type HeaderActionsView = "mobile" | "desktop"

interface HeaderActionsStore {
    isMobileCollapsed: boolean
    isDesktopCollapsed: boolean
    toggleCollapsed: (view: HeaderActionsView) => void
}

export const useHeaderActionsStore = create<HeaderActionsStore>()(
    persist(
        (set) => ({
            isMobileCollapsed: true,
            isDesktopCollapsed: false,
            toggleCollapsed: (view) =>
                set((state) =>
                    view === "mobile"
                        ? { isMobileCollapsed: !state.isMobileCollapsed }
                        : { isDesktopCollapsed: !state.isDesktopCollapsed }
                )
        }),
        { name: "header-actions" }
    )
)
