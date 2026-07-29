// @vitest-environment jsdom

import {
    tableRowsToCsv,
    tableRowsToMarkdown,
    tableRowsToPlainText
} from "@/components/markdown-table"
import { MemoizedMarkdown, normalizeMarkdownMathDelimiters } from "@/components/memoized-markdown"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it } from "vitest"

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverStub
})

describe("MemoizedMarkdown", () => {
    it("serializes table downloads and copies without losing cell boundaries", () => {
        const rows = [
            ["Proposal", "Details"],
            ["Ship, gradually", 'Use the "safe" path']
        ]

        expect(tableRowsToCsv(rows)).toBe(
            'Proposal,Details\r\n"Ship, gradually","Use the ""safe"" path"'
        )
        expect(tableRowsToMarkdown(rows)).toBe(
            '| Proposal | Details |\n| --- | --- |\n| Ship, gradually | Use the "safe" path |'
        )
        expect(tableRowsToPlainText(rows)).toBe(
            'Proposal\tDetails\nShip, gradually\tUse the "safe" path'
        )
    })

    it("normalizes likely single-dollar math without touching currency", () => {
        expect(normalizeMarkdownMathDelimiters("Where $L_{0}$ and $k$ matter.")).toBe(
            "Where $$L_{0}$$ and $$k$$ matter."
        )
        expect(normalizeMarkdownMathDelimiters("Use $(a,b)$ as the interval.")).toBe(
            "Use $$(a,b)$$ as the interval."
        )
        expect(normalizeMarkdownMathDelimiters("Use $3$ as the exponent.")).toBe(
            "Use $$3$$ as the exponent."
        )
        expect(normalizeMarkdownMathDelimiters("It costs $3 and then $30.")).toBe(
            "It costs $3 and then $30."
        )
        expect(normalizeMarkdownMathDelimiters("It costs $20 and then $30.")).toBe(
            "It costs $20 and then $30."
        )
    })

    it("normalizes single-dollar display math fences", () => {
        expect(normalizeMarkdownMathDelimiters("Before\n$\nL(t)=L_{0}e^{-kt}\n$\nAfter")).toBe(
            "Before\n$$\nL(t)=L_{0}e^{-kt}\n$$\nAfter"
        )
    })

    it("leaves incomplete single-dollar math delimiters untouched while streaming", () => {
        expect(normalizeMarkdownMathDelimiters("Where $L_{0} is still streaming")).toBe(
            "Where $L_{0} is still streaming"
        )
        expect(normalizeMarkdownMathDelimiters("Before\n$\nL(t)=L_{0}e^{-kt}\nAfter")).toBe(
            "Before\n$\nL(t)=L_{0}e^{-kt}\nAfter"
        )
    })

    it("renders streamed text at the stream cadence without word reveal animations", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "1. First streamed item",
                isAnimating: true
            })
        )

        expect(container.querySelector("[data-sd-animate]")).toBeNull()
        expect(container.textContent).toContain("First streamed item")
    })

    it("expands and collapses table row contents", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "| Grain | Origin |\n|---|---|\n| Wheat | Fertile Crescent |"
            })
        )

        fireEvent.click(screen.getByRole("button", { name: "Expand all cells" }))

        const tableFrame = container.querySelector("[data-markdown-table]")
        const scroller = container.querySelector("[data-markdown-table-scroll]")

        expect(tableFrame?.getAttribute("data-rows-expanded")).toBe("true")
        expect(scroller?.className).toContain("[&_td>span]:whitespace-normal")
        expect(screen.getByRole("button", { name: "Collapse all cells" })).toBeTruthy()

        fireEvent.click(screen.getByRole("button", { name: "Collapse all cells" }))

        expect(tableFrame?.getAttribute("data-rows-expanded")).toBe("false")
        expect(scroller?.className).toContain("[&_td>span]:truncate")
    })
})
