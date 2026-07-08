import { useDevDisableAnimations, useDevThemeAudit } from "@/lib/dev-overrides"
import { installReproErrorListeners, pushReproEvent } from "@/lib/dev-repro-recorder"
import { type ThemeAuditResult, clearThemeAudit, runThemeAudit } from "@/lib/dev-theme-audit"
import { canUseDevTools } from "@/lib/dev-tools"
import { useLocation } from "@tanstack/react-router"
import { useEffect } from "react"
import { create } from "zustand"

const THEME_AUDIT_INTERVAL_MS = 1500

/** Latest theme-audit counts, published by {@link DevRuntime} for the dock to display. */
export const useThemeAuditResultStore = create<{
    result: ThemeAuditResult | null
    setResult: (result: ThemeAuditResult | null) => void
}>((set) => ({
    result: null,
    setResult: (result) => set({ result })
}))

/**
 * Global side-effects for the dev tools that must run regardless of whether the dock
 * popover is open: the no-animation root marker, the live theme audit, and the repro
 * recorder's error/route listeners. Renders nothing.
 */
export function DevRuntime() {
    const disableAnimations = useDevDisableAnimations()
    const themeAudit = useDevThemeAudit()
    const setResult = useThemeAuditResultStore((state) => state.setResult)
    const location = useLocation()

    // No-animation root marker.
    useEffect(() => {
        if (!canUseDevTools()) return
        const root = document.documentElement
        if (disableAnimations) {
            root.setAttribute("data-dev-no-animations", "")
        } else {
            root.removeAttribute("data-dev-no-animations")
        }
        return () => {
            root.removeAttribute("data-dev-no-animations")
        }
    }, [disableAnimations])

    // Live theme/radius audit loop.
    useEffect(() => {
        if (!canUseDevTools() || !themeAudit) {
            clearThemeAudit()
            setResult(null)
            return
        }

        const scan = () => setResult(runThemeAudit())
        scan()
        const interval = window.setInterval(scan, THEME_AUDIT_INTERVAL_MS)
        return () => {
            window.clearInterval(interval)
            clearThemeAudit()
            setResult(null)
        }
    }, [themeAudit, setResult])

    // Repro recorder: window error listeners (route changes handled below).
    useEffect(() => {
        if (!canUseDevTools()) return
        return installReproErrorListeners()
    }, [])

    // Repro recorder: route timeline.
    useEffect(() => {
        if (!canUseDevTools()) return
        pushReproEvent("route", location.pathname + (location.searchStr ?? ""))
    }, [location.pathname, location.searchStr])

    return null
}
