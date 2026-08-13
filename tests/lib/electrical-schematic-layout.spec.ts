import { electricalCircuitSchema } from "@/lib/electrical-engineering"
import { buildRailSchematicLayout } from "@/lib/electrical-schematic-layout"
import { describe, expect, it } from "vitest"

const source = {
    id: "V1",
    type: "voltage_source" as const,
    nodes: ["vp", "0"],
    source: { kind: "dc" as const, magnitude: "12 V" }
}

describe("electrical rail schematic layout", () => {
    it("places a divider as one conventional vertical branch beside its source", () => {
        const circuit = electricalCircuitSchema.parse({
            title: "Voltage divider",
            components: [
                source,
                {
                    id: "R1",
                    type: "resistor",
                    nodes: ["vp", "vout"],
                    value: "1 kΩ"
                },
                {
                    id: "R2",
                    type: "resistor",
                    nodes: ["vout", "0"],
                    value: "2 kΩ"
                }
            ]
        })

        const layout = buildRailSchematicLayout(circuit)
        const v1 = layout?.components.find((component) => component.componentId === "V1")
        const r1 = layout?.components.find((component) => component.componentId === "R1")
        const r2 = layout?.components.find((component) => component.componentId === "R2")
        const vout = layout?.nets.find((net) => net.nodeId === "vout")

        expect(layout?.kind).toBe("rail")
        expect(v1?.x).toBeLessThan(r1?.x ?? 0)
        expect(r1?.x).toBe(r2?.x)
        expect(r1?.y).toBeLessThan(r2?.y ?? 0)
        expect(vout).toMatchObject({ rail: false })
        expect(vout?.x).toBe((r1?.x ?? 0) + (r1?.width ?? 0) / 2)
    })

    it("places parallel branches side by side between shared rails", () => {
        const circuit = electricalCircuitSchema.parse({
            title: "Parallel load",
            components: [
                source,
                { id: "R1", type: "resistor", nodes: ["vp", "0"], value: "1 kΩ" },
                { id: "R2", type: "resistor", nodes: ["vp", "0"], value: "2 kΩ" }
            ]
        })

        const layout = buildRailSchematicLayout(circuit)
        const r1 = layout?.components.find((component) => component.componentId === "R1")
        const r2 = layout?.components.find((component) => component.componentId === "R2")

        expect(r1?.x).not.toBe(r2?.x)
        expect(r1?.y).toBe(r2?.y)
        expect(r1?.height).toBe(112)
    })

    it("uses the controlled graph fallback when paths share components", () => {
        const circuit = electricalCircuitSchema.parse({
            title: "Loaded filter",
            components: [
                source,
                { id: "R1", type: "resistor", nodes: ["vp", "out"], value: "1 kΩ" },
                { id: "R2", type: "resistor", nodes: ["out", "0"], value: "10 kΩ" },
                { id: "C1", type: "capacitor", nodes: ["out", "0"], value: "100 nF" }
            ]
        })

        expect(buildRailSchematicLayout(circuit)).toBeNull()
    })
})
