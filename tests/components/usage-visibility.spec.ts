// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ mobile: false, useCredits: vi.fn() }))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => state.mobile }))
vi.mock("@/hooks/use-prototype-credits", () => ({ usePrototypeCredits: state.useCredits }))

import { PrototypeCreditsQuickView } from "@/components/credits/prototype-credits"

describe("usage visibility", () => {
    beforeEach(() => {
        state.useCredits.mockReset()
        state.useCredits.mockReturnValue({
            summary: null,
            isLoading: true,
            isRefreshing: false,
            devCreditState: null,
            isUpdatingDevCreditState: false,
            setDevCreditState: vi.fn(),
            refreshCredits: vi.fn()
        })
        vi.stubGlobal(
            "ResizeObserver",
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
        vi.stubGlobal("matchMedia", () => ({
            matches: false,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {}
        }))
    })

    it.each([false, true])(
        "follows open, dismiss, and header collapse (mobile: %s)",
        async (mobile) => {
            state.mobile = mobile
            const view = (enabled: boolean) =>
                createElement(PrototypeCreditsQuickView, {
                    userId: "user-1",
                    isAuthLoading: false,
                    enabled,
                    shouldShowDevCreditPlanToggle: false
                })
            const { rerender } = render(view(true))
            const expectEnabled = (enabled: boolean) =>
                expect(state.useCredits).toHaveBeenLastCalledWith(
                    expect.objectContaining({ enabled })
                )
            expectEnabled(false)
            fireEvent.click(screen.getByRole("button", { name: "Usage" }))
            await waitFor(() => expectEnabled(true))
            expect(screen.getByRole("dialog")).toBeTruthy()

            // Mobile back dismissal and desktop Escape must release usage equally.
            if (mobile) fireEvent(window, new PopStateEvent("popstate", { state: {} }))
            else fireEvent.keyDown(document, { key: "Escape" })
            await waitFor(() => expectEnabled(false))

            fireEvent.click(screen.getByRole("button", { name: "Usage" }))
            await waitFor(() => expectEnabled(true))
            state.mobile = !mobile
            rerender(view(true))
            await waitFor(() => expectEnabled(true))
            expect(screen.getByRole("dialog")).toBeTruthy()
            rerender(view(false))
            expectEnabled(false)
            rerender(view(true))
            expectEnabled(false)
        }
    )
})
