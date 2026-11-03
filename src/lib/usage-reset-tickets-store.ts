import type { UsageLimitWindow } from "@/convex/lib/usage_resets"
import { create } from "zustand"

interface UsageResetTicketsStore {
    open: boolean
    // Set when opened from a limit error: only tickets that lift that limit are usable.
    limit: UsageLimitWindow | null
    show: (limit?: UsageLimitWindow) => void
    hide: () => void
}

// The dialog lives at the layout root, so it survives the usage popover closing.
export const useUsageResetTicketsStore = create<UsageResetTicketsStore>()((set) => ({
    open: false,
    limit: null,
    show: (limit) => set({ open: true, limit: limit ?? null }),
    hide: () => set({ open: false })
}))
