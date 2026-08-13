// @vitest-environment jsdom

import {
    ElectricalPlotRenderer,
    ElectricalPlotToolRenderer
} from "@/components/renderers/electrical-plot-tool"
import { electricalPlotSchema } from "@/lib/electrical-engineering"
import { render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it } from "vitest"

const phasor = electricalPlotSchema.parse({
    type: "phasor",
    title: "Voltage phasors",
    description: "RMS quantities",
    unit: "V",
    phasors: [
        { label: "Vin", magnitude: 10, phaseDeg: 0 },
        { label: "Vout", magnitude: 7.07, phaseDeg: -45 }
    ]
})

const waveform = electricalPlotSchema.parse({
    type: "waveform",
    title: "20 kHz PWM",
    xLabel: "Time (µs)",
    yLabel: "Voltage (V)",
    series: [{ key: "pwm", label: "PWM", unit: "V" }],
    data: [
        { x: 0, pwm: 3.3 },
        { x: 15, pwm: 0 },
        { x: 50, pwm: 3.3 }
    ]
})

describe("ElectricalPlotRenderer", () => {
    it("renders phasors as native SVG without an embedded document", () => {
        const { container } = render(React.createElement(ElectricalPlotRenderer, { plot: phasor }))

        expect(screen.getByText("Voltage phasors")).toBeTruthy()
        expect(container.querySelector("[data-electrical-plot]")).toBeTruthy()
        expect(
            container.querySelector('svg[aria-label="Voltage phasors phasor diagram"]')
        ).toBeTruthy()
        expect(container.querySelector("iframe")).toBeNull()
    })

    it("keeps the waveform legend in a separate band below the axis", () => {
        const { container } = render(
            React.createElement(ElectricalPlotRenderer, { plot: waveform })
        )

        const plotRegion = container.querySelector("[data-waveform-plot]")
        const legend = screen.getByLabelText("Waveform legend")
        expect(plotRegion?.lastElementChild).toBe(legend)
        expect(legend.textContent).toContain("PWM (V)")
    })

    it("recovers valid input only for a tool-budget presentation stop", () => {
        const { rerender } = render(
            React.createElement(ElectricalPlotToolRenderer, {
                toolInvocation: {
                    state: "output-available",
                    input: phasor,
                    output: { success: false, code: "tool_execution_failed" }
                }
            })
        )

        expect(screen.getByText("The electrical plot could not be rendered.")).toBeTruthy()

        rerender(
            React.createElement(ElectricalPlotToolRenderer, {
                toolInvocation: {
                    state: "output-available",
                    input: phasor,
                    output: { success: false, code: "tool_budget_exhausted" }
                }
            })
        )

        expect(screen.getByText("Voltage phasors")).toBeTruthy()
    })
})
