// @vitest-environment jsdom

import { NativeChartRenderer } from "@/components/renderers/native-chart-tool"
import { nativeChartSchema } from "@/lib/native-chart"
import { render, screen } from "@testing-library/react"
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
})
