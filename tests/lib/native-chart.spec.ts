import {
    getBoundedNumericDomain,
    getNativeChartFromToolOutput,
    nativeChartSchema
} from "@/lib/native-chart"
import { describe, expect, it } from "vitest"
import {
    NativeChartAdapter,
    getNativeChartTool,
    withStrictNativeVisualizationTools
} from "../../convex/lib/tools/native_chart"

const validChart = {
    title: "Quadratic growth",
    description: "Values of x squared",
    type: "line" as const,
    xKey: "x",
    xLabel: "Input",
    yLabel: "Output",
    series: [{ key: "y", label: "x²" }],
    data: [
        { x: -1, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 1 }
    ]
}

describe("native chart contract", () => {
    it("bounds numeric axes to the observed data instead of zero", () => {
        expect(getBoundedNumericDomain([2012, 2014, 2018, 2023])).toEqual([2012, 2023])
        expect(getBoundedNumericDomain([2023])).toEqual([2002.77, 2043.23])
        expect(getBoundedNumericDomain([])).toBeNull()
    })

    it("accepts bounded numeric series and supplies display defaults", () => {
        const parsed = nativeChartSchema.parse(validChart)

        expect(parsed.showLegend).toBe(true)
        expect(parsed.stacked).toBe(false)
        expect(parsed.xScale).toBe("category")
        expect(parsed.data).toHaveLength(3)
    })

    it("rejects rows whose series values are not numeric", () => {
        const parsed = nativeChartSchema.safeParse({
            ...validChart,
            data: [{ x: 1, y: "one" }]
        })

        expect(parsed.success).toBe(false)
    })

    it("requires numeric x values for scatter charts", () => {
        const parsed = nativeChartSchema.safeParse({
            ...validChart,
            type: "scatter",
            data: [{ x: "one", y: 1 }]
        })

        expect(parsed.success).toBe(false)
    })

    it("supports linear axes for sampled functions", () => {
        expect(nativeChartSchema.parse({ ...validChart, xScale: "linear" }).xScale).toBe("linear")
        expect(
            nativeChartSchema.safeParse({
                ...validChart,
                xScale: "linear",
                data: [{ x: "zero", y: 0 }]
            }).success
        ).toBe(false)
    })

    it("recovers a persisted chart only from a valid tool result", () => {
        expect(
            getNativeChartFromToolOutput({
                success: true,
                kind: "native_chart",
                chart: validChart
            })
        ).toMatchObject({ title: "Quadratic growth", showLegend: true })
        expect(getNativeChartFromToolOutput({ kind: "native_chart", chart: validChart })).toBeNull()
    })

    it("registers the chart tool and returns a replayable result", async () => {
        const tools = getNativeChartTool({ enabled: true, strict: true })
        expect(tools.render_chart?.strict).toBe(true)
        const output = await tools.render_chart?.execute?.(
            nativeChartSchema.parse(validChart),
            {} as never
        )

        expect(getNativeChartFromToolOutput(output)).toMatchObject({
            title: "Quadratic growth",
            showLegend: true
        })
        expect(getNativeChartTool({ enabled: false })).toEqual({})
    })

    it("only exposes chart rendering when Math Kit is enabled", async () => {
        const toolAvailability = {
            web_search: { enabled: false, fundingSource: "none" as const },
            code_execution: { enabled: false, fundingSource: "none" as const },
            mathematical_instruments: { enabled: true, fundingSource: "none" as const },
            electrical_engineering: { enabled: true, fundingSource: "none" as const },
            supermemory: { enabled: false, fundingSource: "none" as const },
            mcp: { enabled: false, fundingSource: "none" as const }
        }
        const baseParams = {
            toolAvailability,
            userSettings: {} as never,
            ctx: {} as never
        }

        expect(await NativeChartAdapter({ ...baseParams, enabledTools: [] })).toEqual({})
        const tools = await NativeChartAdapter({
            ...baseParams,
            enabledTools: ["mathematical_instruments"]
        })

        expect(Object.keys(tools)).toEqual(["render_chart", "render_network"])
        expect(tools.render_chart?.strict).toBeUndefined()
        expect(tools.render_network?.strict).toBeUndefined()

        const strictTools = withStrictNativeVisualizationTools(tools)
        expect(strictTools).toMatchObject({
            render_chart: { strict: true },
            render_network: { strict: true }
        })
    })
})
