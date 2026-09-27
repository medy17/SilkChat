// @vitest-environment jsdom

import { NativeChartRenderer } from "@/components/renderers/native-chart-tool"
import { nativeChartSchema } from "@/lib/native-chart"
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

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: function (this: HTMLElement) {
        const height = this.classList.contains("recharts-legend-wrapper") ? 24 : 300
        return {
            width: 800,
            height,
            top: 0,
            right: 800,
            bottom: height,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => ({})
        }
    }
})

describe("NativeChartRenderer", () => {
    it("renders a validated chart as a native message component", () => {
        const chart = nativeChartSchema.parse({
            title: "Monthly signups",
            description: "New accounts created each month",
            type: "bar",
            xKey: "month",
            series: [{ key: "signups", label: "Signups" }],
            data: [
                { month: "Jan", signups: 12 },
                { month: "Feb", signups: 18 }
            ]
        })

        const { container } = render(React.createElement(NativeChartRenderer, { chart }))

        expect(screen.getByText("Monthly signups")).toBeTruthy()
        expect(screen.getByText("New accounts created each month")).toBeTruthy()
        expect(container.querySelector("[data-native-chart]")).toBeTruthy()
        expect(container.querySelector("[data-chart]")).toBeTruthy()
        expect(container.querySelector("svg.recharts-surface")).toBeTruthy()
        expect(container.querySelector(".recharts-bar")).toBeTruthy()
        expect(container.querySelector("iframe")).toBeNull()
    })

    it("switches to the exact data rows behind the chart", () => {
        const chart = nativeChartSchema.parse({
            title: "Revenue",
            type: "line",
            xKey: "month",
            series: [
                { key: "revenue", label: "Revenue" },
                { key: "costs", label: "Costs" }
            ],
            data: [
                { month: "Jan", revenue: 128_450.5, costs: null },
                { month: "Feb", revenue: 131_020, costs: 90_000 },
                { month: "Mar", revenue: 0.0000001, costs: 90_000 }
            ]
        })

        const { container } = render(React.createElement(NativeChartRenderer, { chart }))
        fireEvent.mouseDown(screen.getByRole("tab", { name: "Table" }), { button: 0 })

        const table = container.querySelector("[data-native-chart-table] table")
        expect(table?.textContent).toContain("128,450.5")
        expect(table?.textContent).toContain("–")
        expect(table?.textContent).toContain("1e-7")

        fireEvent.click(screen.getByRole("button", { name: "Costs" }))
        expect(table?.textContent).not.toContain("Costs")
        expect(table?.textContent).toContain("Revenue")
    })

    it("opens a large focus view for the chart", () => {
        const chart = nativeChartSchema.parse({
            title: "Expanded curve",
            type: "line",
            xKey: "x",
            xScale: "linear",
            series: [{ key: "y", label: "y" }],
            data: [
                { x: 0, y: 0 },
                { x: 1, y: 1 }
            ]
        })

        render(React.createElement(NativeChartRenderer, { chart }))
        const expandButton = screen.getByRole("button", { name: "Expand chart" })
        expect(expandButton.classList.contains("hidden")).toBe(true)
        expect(expandButton.classList.contains("md:flex")).toBe(true)
        fireEvent.click(expandButton)

        const dialog = screen.getByRole("dialog")
        expect(dialog.textContent).toContain("Expanded curve")
        expect(dialog.classList.contains("bg-card")).toBe(true)
        expect(
            document
                .querySelector('[data-slot="dialog-overlay"]')
                ?.classList.contains("backdrop-blur-md")
        ).toBe(true)
        expect(dialog.style.width).toBe("92vw")
        expect(dialog.style.height).toBe("85vh")
        expect(dialog.style.maxWidth).toBe("80rem")
        expect(dialog.style.maxHeight).toBe("56rem")
        expect(screen.getByRole("button", { name: "Close expanded chart" })).toBeTruthy()
        expect(dialog.querySelector("[data-chart]")).toBeTruthy()
        expect(document.querySelectorAll("svg.recharts-surface")).toHaveLength(2)
    })
})
