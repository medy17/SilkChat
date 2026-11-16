// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { Fragment, createElement } from "react"
import { describe, expect, it } from "vitest"
import { FlyoutPageSwap } from "@/components/skills/skills-flyout"

const view = (detailOpen: boolean) =>
    createElement(FlyoutPageSwap, {
        detailOpen,
        detail: createElement("button", { type: "button" }, "Back"),
        children: createElement(
            Fragment,
            null,
            createElement("button", { type: "button" }, "Magic"),
            createElement("button", { type: "button" }, "Skills")
        )
    })

describe("flyout pages", () => {
    it("keeps both pages mounted and hides the one that isn't showing", () => {
        const { rerender } = render(view(false))
        expect(screen.getByText("Back").closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe(
            "true"
        )
        rerender(view(true))
        expect(
            screen.getByText("Skills").closest("[aria-hidden]")?.getAttribute("aria-hidden")
        ).toBe("true")
        expect(screen.getByText("Back").closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe(
            "false"
        )
    })

    it("moves focus into the detail page and back to what opened it", () => {
        const { rerender } = render(view(false))
        screen.getByText("Skills").focus()
        rerender(view(true))
        expect(document.activeElement).toBe(screen.getByText("Back"))
        rerender(view(false))
        expect(document.activeElement).toBe(screen.getByText("Skills"))
    })
})
