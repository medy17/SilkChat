// @vitest-environment jsdom

import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import { render } from "@testing-library/react"
import React from "react"
import { describe, expect, it } from "vitest"

const TestCollapsible = AnimatedCollapsible as React.ComponentType<{
    open: boolean
    children?: React.ReactNode
}>

describe("AnimatedCollapsible", () => {
    it("keeps an open parent dynamically sized when nested content expands", () => {
        const NestedContent = ({ detailsOpen }: { detailsOpen: boolean }) =>
            React.createElement(
                TestCollapsible,
                { open: true },
                React.createElement("div", { key: "output" }, "Execution output"),
                React.createElement(
                    TestCollapsible,
                    { key: "details", open: detailsOpen },
                    React.createElement("div", null, "Execution details")
                )
            )

        const { container, rerender } = render(
            React.createElement(NestedContent, { detailsOpen: false })
        )
        const parent = container.firstElementChild as HTMLElement

        expect(parent.style.gridTemplateRows).toBe("1fr")
        expect(parent.style.maxHeight).toBe("")

        rerender(React.createElement(NestedContent, { detailsOpen: true }))

        expect(parent.style.gridTemplateRows).toBe("1fr")
        expect(parent.style.maxHeight).toBe("")
        expect(parent.textContent).toContain("Execution details")
    })
})
