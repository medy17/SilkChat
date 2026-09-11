// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"
const sidebar = vi.hoisted(() => ({ isMobile: false, open: true, openMobile: false }))
vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => sidebar }))
import { useSidebarVisible } from "@/hooks/use-sidebar-visible"

it("waits for hydration and follows the correct desktop/mobile open state", () => {
    const renders: boolean[] = []
    const { result, rerender } = renderHook(() => {
        const visible = useSidebarVisible()
        renders.push(visible)
        return visible
    })
    expect(renders[0]).toBe(false)
    expect(result.current).toBe(true)
    sidebar.open = false
    rerender()
    expect(result.current).toBe(false)
    sidebar.isMobile = true
    sidebar.open = true
    rerender()
    expect(result.current).toBe(false)
    sidebar.openMobile = true
    rerender()
    expect(result.current).toBe(true)
    sidebar.openMobile = false
    rerender()
    expect(result.current).toBe(false)
})
