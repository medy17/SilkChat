import { useSidebar } from "@/components/ui/sidebar"
import { useEffect, useState } from "react"

export function useSidebarVisible() {
    const { isMobile, open, openMobile } = useSidebar()
    const [mounted, setMounted] = useState(false)
    // The mobile breakpoint resolves after mount. Do not briefly subscribe using
    // the desktop default on a direct load into a closed mobile sidebar.
    useEffect(() => setMounted(true), [])
    return mounted && (isMobile ? openMobile : open)
}
