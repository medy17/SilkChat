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

    it("preserves soft line breaks inside a paragraph", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "First line\nSecond line"
            })
        )

        const paragraph = container.querySelector("p")

        expect(paragraph).toBeTruthy()
        expect(paragraph?.textContent).toBe("First line\nSecond line")
        expect(paragraph?.className).toContain("whitespace-pre-wrap")
    })

    it("renders blank-line separated text as separate paragraphs", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "First paragraph\n\nSecond paragraph\n\n\nThird paragraph"
            })
        )

        const paragraphs = Array.from(container.querySelectorAll("p"))

        expect(paragraphs.map((paragraph) => paragraph.textContent)).toEqual([
            "First paragraph",
            "Second paragraph",
            "Third paragraph"
        ])
        expect(paragraphs.every((paragraph) => paragraph.className.includes("my-3"))).toBe(true)
    })

    it("renders inline code and previewable fenced blocks through Streamdown", () => {
        render(
            React.createElement(MemoizedMarkdown, {
                content: "Here is `inline` code.\n\n```html\n<div>Hello</div>\n```"
            })
        )

        expect(screen.getByText("inline").closest("code")).toBeTruthy()
        expect(screen.getByRole("tab", { name: "Code" })).toBeTruthy()
        expect(screen.getByRole("tab", { name: "Preview" })).toBeTruthy()
        expect(screen.getAllByText("html").length).toBeGreaterThan(0)
    })

    it("renders markdown tables in a scrollable viewport with table actions", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content:
                    "| Grain | Origin |\n|---|---|\n| Wheat | Fertile Crescent |\n| Barley | Fertile Crescent |"
            })
        )

        const table = container.querySelector("table")
        const tableFrame = container.querySelector("[data-markdown-table]")
        const scroller = container.querySelector("[data-markdown-table-scroll]")

        expect(table).toBeTruthy()
        expect(table?.className).toContain("w-max")
        expect(table?.className).toContain("min-w-full")
        expect(tableFrame?.className).toContain("not-prose")
        expect(container.querySelector("[data-markdown-table-viewport]")).toBeTruthy()
        const scrollbar = container.querySelector("[data-markdown-table-scrollbar]")
        expect(scrollbar?.className).toContain("h-2")
        expect(scrollbar?.className).not.toContain("border-t")
        expect(tableFrame?.getAttribute("data-rows-expanded")).toBe("false")
        expect(scroller?.className).toContain("[&_td>span]:truncate")
        expect(screen.getByRole("button", { name: "Expand table rows" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Download table" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Copy table as Markdown" })).toBeTruthy()
        expect(container.querySelector("[data-streamdown='table-wrapper']")).toBeNull()
    })

    it("expands and collapses table row contents", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "| Grain | Origin |\n|---|---|\n| Wheat | Fertile Crescent |"
            })
        )

        fireEvent.click(screen.getByRole("button", { name: "Expand table rows" }))

        const tableFrame = container.querySelector("[data-markdown-table]")
        const scroller = container.querySelector("[data-markdown-table-scroll]")

        expect(tableFrame?.getAttribute("data-rows-expanded")).toBe("true")
        expect(scroller?.className).toContain("[&_td>span]:whitespace-normal")
        expect(screen.getByRole("button", { name: "Collapse table rows" })).toBeTruthy()

        fireEvent.click(screen.getByRole("button", { name: "Collapse table rows" }))

        expect(tableFrame?.getAttribute("data-rows-expanded")).toBe("false")
        expect(scroller?.className).toContain("[&_td>span]:truncate")
    })
})
