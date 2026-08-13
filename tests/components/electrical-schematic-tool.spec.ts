// @vitest-environment jsdom

import {
    ElectricalSchematicRenderer,
    formatElectricalQuantity
} from "@/components/renderers/electrical-schematic-tool"
import { electricalCircuitSchema } from "@/lib/electrical-engineering"
import { render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it } from "vitest"

describe("ElectricalSchematicRenderer", () => {
    it("uses conventional engineering symbols for quantities", () => {
        expect(formatElectricalQuantity("1 kohm")).toBe("1 kΩ")
        expect(formatElectricalQuantity("2 kOhms")).toBe("2 kΩ")
        expect(formatElectricalQuantity("470 uF")).toBe("470 µF")
    })

    it("renders a compact coloured divider without duplicate component labels", () => {
        const circuit = electricalCircuitSchema.parse({
            title: "12 V resistor divider",
            components: [
                {
                    id: "V1",
                    type: "voltage_source",
                    nodes: ["vp", "0"],
                    source: { kind: "dc", magnitude: "12 V" },
                    label: "12 V source"
                },
                {
                    id: "R1",
                    type: "resistor",
                    nodes: ["vp", "vout"],
                    value: "1 kΩ",
                    label: "R1 = 1 kΩ"
                },
                {
                    id: "R2",
                    type: "resistor",
                    nodes: ["vout", "0"],
                    value: "2 kΩ",
                    label: "R2 = 2 kΩ"
                }
            ]
        })

        const { container } = render(React.createElement(ElectricalSchematicRenderer, { circuit }))

        expect(screen.getAllByText("R1")).toHaveLength(1)
        expect(screen.getAllByText("1 kΩ")).toHaveLength(1)
        expect(screen.getByText("Vout")).toBeTruthy()
        expect(container.querySelector('[stroke="var(--chart-1)"]')).toBeTruthy()
        expect(container.querySelector('[stroke="var(--chart-2)"]')).toBeTruthy()
        expect(container.querySelector('[stroke="var(--destructive)"]')).toBeTruthy()
        expect(container.querySelector("iframe")).toBeNull()
    })
})
