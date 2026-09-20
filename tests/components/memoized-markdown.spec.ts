// @vitest-environment jsdom

import {
    tableRowsToCsv,
    tableRowsToMarkdown,
    tableRowsToPlainText
} from "@/components/markdown-table"
import { MemoizedMarkdown, normalizeMarkdownMathDelimiters } from "@/components/memoized-markdown"
import { advanceRecipeTimer } from "@/components/recipe-card"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverStub
})

// Streamdown scrolls overflowing code during streaming; jsdom has no element scrollTo.
Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: () => {}, configurable: true })

describe("MemoizedMarkdown", () => {
    it("subtracts real elapsed time when a timer wakes after being idle", () => {
        const timer = {
            total: 480,
            remaining: 480,
            running: true,
            finished: false,
            startedAt: 1_000
        }

        const recovered = advanceRecipeTimer(timer, 301_000)
        expect(recovered).toMatchObject({ remaining: 180, running: true, startedAt: 301_000 })
        expect(advanceRecipeTimer(recovered, 481_000)).toMatchObject({
            remaining: 0,
            running: false,
            finished: true,
            startedAt: undefined
        })
    })

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

    it("normalizes standalone double-dollar equations into display fences", () => {
        expect(
            normalizeMarkdownMathDelimiters(
                "Before\n\n$$ \\frac{x^{2}}{y^{3}} + \\sqrt{2} $$\n\nAfter"
            )
        ).toBe("Before\n\n$$\n\\frac{x^{2}}{y^{3}} + \\sqrt{2}\n$$\n\nAfter")
        expect(normalizeMarkdownMathDelimiters("Keep $$x^2$$ inline here.")).toBe(
            "Keep $$x^2$$ inline here."
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

    it("renders standalone double-dollar equations as display math", async () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "Before\n\n$$ \\frac{x^{2}}{y^{3}}+\\sqrt{2} $$\n\nAfter"
            })
        )

        await waitFor(() => expect(container.querySelector(".katex-display")).toBeTruthy(), {
            timeout: 5000
        })
        expect(container.querySelector(".math-inline")).toBeNull()
    })

    it("adds streamed math without replacing an expanded code block", async () => {
        const code = Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n")
        const prefix = `Code:\n\n\`\`\`text\n${code}\n\`\`\`\n\nEquation: `
        const view = (suffix: string) =>
            React.createElement(MemoizedMarkdown, {
                content: prefix + suffix,
                isAnimating: true
            })
        const { container, rerender } = render(view(""))
        fireEvent.click(await screen.findByRole("button", { name: /more lines/ }))
        const block = container.querySelector("[data-message-code-block]")
        expect(block).toBeTruthy()

        rerender(view("$$\\frac{x"))
        rerender(view("$$\\frac{x}{2}$$"))
        await waitFor(() => expect(container.querySelector(".katex")).toBeTruthy(), {
            timeout: 5000
        })
        expect(container.querySelector(".katex-display")).toBeNull()
        expect(container.querySelector("[data-message-code-block]")).toBe(block)
        expect(screen.queryByRole("button", { name: /more lines/ })).toBeNull()
        expect(container.querySelector("annotation")?.textContent).toBe("\\frac{x}{2}")
    })

    it("keeps currency and math-looking code as text", () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content: "It costs $20 and then $30.\n\n`$$x^2$$`\n\n```text\n$$y^2$$\n```"
            })
        )
        expect(container.textContent).toContain("It costs $20 and then $30.")
        expect(container.textContent).toContain("$$x^2$$")
        expect(container.querySelector(".katex")).toBeNull()
        expect(screen.queryByRole("status")).toBeNull()
    })

    it("renders math fences and handles invalid or untrusted TeX safely", async () => {
        const { container } = render(
            React.createElement(MemoizedMarkdown, {
                content:
                    "```math\nx^2\n```\n\nInvalid $$\\frac{1}$$.\n\nLink $$\\href{javascript:alert(1)}{click}$$."
            })
        )
        await waitFor(() => expect(container.querySelector(".katex-display")).toBeTruthy(), {
            timeout: 5000
        })
        expect(container.querySelector(".katex-error")).toBeTruthy()
        expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
        expect(container.querySelector("script")).toBeNull()
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

    it("upgrades captured recipe markup and scales opted-in quantities", () => {
        render(
            React.createElement(MemoizedMarkdown, {
                content: `<recipe servings="2">
# Tomato Soup

<description>A quick tomato soup.</description>

## Ingredients
- <qty value="200" unit="g" scale>200 g</qty> tomatoes
- salt to taste

## Steps
1. <step>Simmer for <timer value="PT8M">8 minutes</timer>.</step>
</recipe>`
            })
        )

        expect(screen.getByRole("heading", { name: "Tomato Soup" })).toBeTruthy()
        expect(screen.getByText("A quick tomato soup.")).toBeTruthy()
        expect(screen.getByText("200 g")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Increase servings" }))
        expect(screen.getByText("300 g")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Units: Original" }))
        fireEvent.click(screen.getByRole("radio", { name: /Imperial/ }))
        expect(screen.getByText(/oz$/)).toBeTruthy()
        expect(screen.getByRole("button", { name: "Units: Imperial" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Start 8 minutes timer" })).toBeTruthy()
    })

    it("shares step state and supports full-screen keyboard navigation", () => {
        render(
            React.createElement(MemoizedMarkdown, {
                content: `<recipe servings="2">
# Tomato Soup

<description>A quick tomato soup.</description>

## Ingredients
- <qty value="200" unit="g" scale>200 g</qty> tomatoes

## Steps
1. <step>Simmer for <timer value="PT8M">8 minutes</timer>.</step>
2. <step>Serve.</step>
</recipe>`
            })
        )

        fireEvent.click(screen.getByRole("button", { name: "Start 8 minutes timer" }))
        fireEvent.click(screen.getByRole("button", { name: "Mark step 1 complete" }))
        fireEvent.click(screen.getByRole("button", { name: "Cook Mode" }))
        expect(screen.getAllByText("A quick tomato soup.")).toHaveLength(2)
        fireEvent.keyDown(window, { key: "ArrowRight" })
        expect(screen.getByText("Step 2 of 2")).toBeTruthy()
        fireEvent.keyDown(window, { key: "ArrowLeft" })

        expect(screen.getByRole("button", { name: "Pause 8 minutes timer" })).toBeTruthy()
        fireEvent.keyDown(window, { key: "ArrowRight" })
        expect(screen.getByText("Step 2 of 2")).toBeTruthy()
        fireEvent.keyDown(window, { key: "Escape" })
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull()
        expect(
            screen
                .getByRole("button", { name: "Mark step 1 incomplete" })
                .getAttribute("aria-pressed")
        ).toBe("true")
    })

    it("resets ingredient and step progress together", () => {
        render(
            React.createElement(MemoizedMarkdown, {
                content: `<recipe servings="2">
# Tomato Soup

## Ingredients
- <qty value="200" unit="g" scale>200 g</qty> tomatoes

## Steps
1. <step>Simmer for <timer value="PT8M">8 minutes</timer>.</step>
</recipe>`
            })
        )

        const ingredient = screen.getByRole("checkbox") as HTMLInputElement
        fireEvent.click(ingredient)
        fireEvent.click(screen.getByRole("button", { name: "Mark step 1 complete" }))
        fireEvent.click(screen.getByRole("button", { name: "Reset recipe progress" }))

        expect(ingredient.checked).toBe(false)
        expect(
            screen
                .getByRole("button", { name: "Mark step 1 complete" })
                .getAttribute("aria-pressed")
        ).toBe("false")
        expect(
            screen.getByRole("button", { name: "Reset recipe progress" }).hasAttribute("disabled")
        ).toBe(true)
    })

    it("prints a body-level recipe clone and cleans it up after printing", () => {
        const print = vi.spyOn(window, "print").mockImplementation(() => {})
        render(
            React.createElement(MemoizedMarkdown, {
                content: `<recipe servings="2">
# Tomato Soup

## Ingredients
- <qty value="200" unit="g" scale>200 g</qty> tomatoes

## Steps
1. <step>Simmer for <timer value="PT8M">8 minutes</timer>.</step>
</recipe>`
            })
        )

        fireEvent.click(screen.getByRole("button", { name: "Print recipe" }))

        const printRoot = document.querySelector("body > [data-recipe-print-root]")
        expect(print).toHaveBeenCalledOnce()
        expect(printRoot?.textContent).toContain("Ingredients")
        expect(printRoot?.textContent).toContain("Method")
        expect(printRoot?.textContent).toContain("8 minutes")
        expect(printRoot?.textContent).not.toContain("0 of 1 checked")
        expect(printRoot?.querySelector("[data-recipe-print-timer-control]")).toBeNull()
        expect(document.documentElement.classList.contains("recipe-printing")).toBe(true)

        window.dispatchEvent(new Event("afterprint"))
        expect(document.querySelector("body > [data-recipe-print-root]")).toBeNull()
        expect(document.documentElement.classList.contains("recipe-printing")).toBe(false)
        print.mockRestore()
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
