import {
    analyzeCircuitInputSchema,
    electricalCircuitSchema,
    electricalPlotSchema,
    getCircuitFromToolOutput,
    getElectricalPlotFromToolOutput
} from "@/lib/electrical-engineering"
import { describe, expect, it, vi } from "vitest"
import {
    ElectricalEngineeringAdapter,
    getElectricalRenderingTools,
    withStrictElectricalTools
} from "../../convex/lib/tools/electrical_engineering"

const divider = {
    title: "Voltage divider",
    components: [
        {
            id: "V1",
            type: "voltage_source" as const,
            nodes: ["in", "0"],
            source: { kind: "dc" as const, magnitude: "12 V" }
        },
        { id: "R1", type: "resistor" as const, nodes: ["in", "out"], value: "1 kohm" },
        { id: "R2", type: "resistor" as const, nodes: ["out", "0"], value: "2 kohm" }
    ],
    ports: [{ id: "output", positive: "out", negative: "0" }]
}

describe("electrical engineering contracts", () => {
    it("accepts a unit-bearing circuit and supplies layout defaults", () => {
        const parsed = electricalCircuitSchema.parse(divider)

        expect(parsed.layout).toEqual({ direction: "right", showNodeLabels: true })
        expect(parsed.components[0].orientation).toBe("horizontal")
    })

    it("rejects duplicate component ids and missing passive values", () => {
        const parsed = electricalCircuitSchema.safeParse({
            title: "Invalid",
            components: [
                { id: "R1", type: "resistor", nodes: ["a", "0"] },
                { id: "R1", type: "resistor", nodes: ["a", "0"], value: "1 kohm" }
            ]
        })

        expect(parsed.success).toBe(false)
    })

    it("rejects analysis references that are not declared by the circuit", () => {
        const parsed = analyzeCircuitInputSchema.safeParse({
            purpose: "Find an equivalent",
            circuit: divider,
            analysis: { type: "equivalent", kind: "thevenin", port: "missing" }
        })

        expect(parsed.success).toBe(false)
    })

    it("validates electrical plots and replay outputs", async () => {
        const plot = electricalPlotSchema.parse({
            type: "phasor",
            title: "AC quantities",
            unit: "V",
            phasors: [{ label: "Vout", magnitude: 4, phaseDeg: -45 }]
        })
        const tools = getElectricalRenderingTools({ enabled: true })
        const circuitOutput = await tools.render_schematic?.execute?.(
            electricalCircuitSchema.parse(divider),
            {} as never
        )
        const plotOutput = await tools.render_electrical_plot?.execute?.(plot, {} as never)

        expect(getCircuitFromToolOutput(circuitOutput)?.title).toBe("Voltage divider")
        expect(getElectricalPlotFromToolOutput(plotOutput)).toMatchObject({ type: "phasor" })
        expect(
            getCircuitFromToolOutput({ kind: "electrical_schematic", circuit: divider })
        ).toBeNull()
    })

    it("makes dynamic waveform value types explicit in the renderer contract", () => {
        const tools = getElectricalRenderingTools({ enabled: true })

        expect(tools.render_electrical_plot?.description).toContain(
            'Wrong: {"x": 0.5, "vin": "1.25"}'
        )
        expect(tools.render_electrical_plot?.description).toContain(
            "every data row contains every declared series key"
        )
        expect(tools.render_schematic?.description).toContain(
            "preserving required fields, nesting, and JSON types"
        )
    })

    it("registers renderers without a sandbox and analysis with one", async () => {
        const runAction = vi.fn().mockResolvedValue({
            success: true,
            stdout: '{"success":true,"kind":"circuit_analysis","analysisType":"dc_operating_point","nodes":{},"branches":{}}',
            __toolBilling: { settledMicrousd: 100, pricingSource: "sandbox_reported" }
        })
        const base = {
            enabledTools: ["electrical_engineering" as const],
            userSettings: { userId: "user-1" } as never,
            ctx: { runAction } as never,
            toolAvailability: {
                web_search: { enabled: false, fundingSource: "none" as const },
                code_execution: { enabled: false, fundingSource: "none" as const },
                mathematical_instruments: { enabled: true, fundingSource: "none" as const },
                electrical_engineering: { enabled: true, fundingSource: "none" as const },
                supermemory: { enabled: false, fundingSource: "none" as const },
                mcp: { enabled: false, fundingSource: "none" as const }
            }
        }

        const renderingOnly = await ElectricalEngineeringAdapter(base)
        expect(Object.keys(renderingOnly)).toEqual(["render_schematic", "render_electrical_plot"])

        const withSandbox = await ElectricalEngineeringAdapter({
            ...base,
            toolAvailability: {
                ...base.toolAvailability,
                code_execution: { enabled: true, fundingSource: "deployment" as const }
            }
        })
        const output = await withSandbox.analyze_circuit?.execute?.(
            {
                purpose: "Solve the divider",
                circuit: divider,
                analysis: { type: "dc_operating_point" }
            },
            {} as never
        )

        expect(output).toMatchObject({
            success: true,
            kind: "circuit_analysis",
            __toolBilling: { settledMicrousd: 100 }
        })
        expect(runAction).toHaveBeenCalledOnce()
        expect(withStrictElectricalTools(withSandbox)).toMatchObject({
            analyze_circuit: { strict: true },
            render_schematic: { strict: true },
            render_electrical_plot: { strict: true }
        })
    })
})
