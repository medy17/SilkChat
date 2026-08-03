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
        const expandedChart = dialog.querySelector("[data-chart]") as HTMLElement | null
        expect(expandedChart?.parentElement?.style.paddingLeft).toBe("16px")
        expect(expandedChart?.parentElement?.style.paddingTop).toBe("16px")
        expect(expandedChart?.style.height).toBe("284px")
        expect(document.querySelectorAll("svg.recharts-surface")).toHaveLength(2)
    })
})
