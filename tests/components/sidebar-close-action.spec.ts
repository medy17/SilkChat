// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { sheetAnimationEndHandlerRef } = vi.hoisted(() => ({
    sheetAnimationEndHandlerRef: {
        current: null as ((event: unknown) => void) | null
    }
}))

vi.mock("@/hooks/use-mobile", () => ({
    useIsMobile: () => true
}))

vi.mock("@/hooks/use-overlay-back-dismiss", () => ({
    useOverlayBackDismiss: () => undefined
}))

vi.mock("@/components/ui/sheet", async () => {
    const ReactModule = await import("react")
    const OpenContext = ReactModule.createContext(false)

    return {
        Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
            ReactModule.createElement(OpenContext.Provider, { value: open }, children),
        SheetContent: ({ children, onAnimationEnd, ...props }: React.ComponentProps<"div">) => {
            const open = ReactModule.useContext(OpenContext)
            sheetAnimationEndHandlerRef.current = onAnimationEnd as (event: unknown) => void
            return ReactModule.createElement(
                "div",
                { ...props, "data-slot": "sheet-content", "data-state": open ? "open" : "closed" },
                children
            )
        },
        SheetDescription: ({ children }: { children: React.ReactNode }) =>
            ReactModule.createElement("div", null, children),
        SheetTitle: ({ children }: { children: React.ReactNode }) =>
            ReactModule.createElement("div", null, children)
    }
})

import { Sidebar, SidebarProvider, useSidebar } from "@/components/ui/sidebar"

function SidebarCloseHarness({ onAction }: { onAction: () => void }) {
    const { closeMobileThen, setOpenMobile } = useSidebar()

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(
            "button",
            { type: "button", onClick: () => setOpenMobile(true) },
            "Open sidebar"
        ),
        React.createElement(
            Sidebar,
            null,
            React.createElement(
                "button",
                { type: "button", onClick: () => closeMobileThen(onAction) },
                "Choose destination"
            )
        )
    )
}

const renderHarness = (onAction: () => void) =>
    render(
        React.createElement(
            SidebarProvider,
            null,
            React.createElement(SidebarCloseHarness, { onAction })
        )
    )

describe("mobile sidebar close actions", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("waits for the closing animation and following paint before running the action", () => {
        const animationFrames: FrameRequestCallback[] = []
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            animationFrames.push(callback)
            return animationFrames.length
        })
        const onAction = vi.fn()
        renderHarness(onAction)

        fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }))
        fireEvent.click(screen.getByRole("button", { name: "Choose destination" }))

        expect(onAction).not.toHaveBeenCalled()

        const sheet = document.querySelector<HTMLElement>('[data-slot="sheet-content"]')
        expect(sheet?.dataset.state).toBe("closed")
        sheetAnimationEndHandlerRef.current?.({ target: sheet, currentTarget: sheet })

        expect(onAction).not.toHaveBeenCalled()
        animationFrames.shift()?.(0)
        expect(onAction).not.toHaveBeenCalled()
        animationFrames.shift()?.(16)
        expect(onAction).toHaveBeenCalledOnce()
    })

    it("uses a fallback if the browser does not emit an animation event", () => {
        vi.useFakeTimers()
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            callback(0)
            return 1
        })
        const onAction = vi.fn()
        renderHarness(onAction)

        fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }))
        fireEvent.click(screen.getByRole("button", { name: "Choose destination" }))

        vi.advanceTimersByTime(399)
        expect(onAction).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(onAction).toHaveBeenCalledOnce()
    })
})
