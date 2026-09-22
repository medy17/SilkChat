import {
    getBoundedNumericDomain,
    getNativeChartFromToolOutput,
    nativeChartInputSchema,
    nativeChartSchema
} from "@/lib/native-chart"
import { describe, expect, it } from "vitest"
import {
    NativeChartAdapter,
    getNativeChartTool,
    withStrictNativeNetworkTool
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

const completeChart = {
    ...validChart,
    xScale: "linear" as const,
    showLegend: true,
    stacked: false
}

describe("native chart contract", () => {
    it.each(Object.keys(completeChart))("requires %s in new tool calls", (key) => {
        const incomplete: Record<string, unknown> = { ...completeChart }
        delete incomplete[key]
        expect(nativeChartInputSchema.safeParse(incomplete).success).toBe(false)
    })

    it("accepts empty optional display text while retaining chart data validation", () => {
        expect(
            nativeChartInputSchema.safeParse({
                ...completeChart,
                description: "",
                xLabel: "",
                yLabel: ""
            }).success
        ).toBe(true)
        expect(
            nativeChartInputSchema.safeParse({
                ...completeChart,
                data: [{ x: 1, y: "one" }]
            }).success
        ).toBe(false)
    })

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
        const tools = getNativeChartTool({ enabled: true })
        const output = await tools.render_chart?.execute?.(
            nativeChartInputSchema.parse(completeChart),
            {} as never
        )

        expect(getNativeChartFromToolOutput(output)).toMatchObject({
            title: "Quadratic growth",
            showLegend: true
        })
        expect(getNativeChartTool({ enabled: false })).toEqual({})
    })

    it.each([false, true])(
        "exposes the requested chart contract only when Math Kit is enabled (useStrictCharts=%s)",
        async (useStrictCharts) => {
            const toolAvailability = {
                web_search: { enabled: false, fundingSource: "none" as const },
                code_execution: { enabled: false, fundingSource: "none" as const },
                mathematical_instruments: { enabled: true, fundingSource: "none" as const },
                supermemory: { enabled: false, fundingSource: "none" as const }
            }
            const baseParams = {
                toolAvailability,
                useStrictCharts,
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
            expect(tools.render_chart?.inputSchema).toBe(
                useStrictCharts ? nativeChartInputSchema : nativeChartSchema
            )
            expect(tools.render_network?.strict).toBeUndefined()

            const strictTools = withStrictNativeNetworkTool(tools)
            expect(strictTools).toMatchObject({
                render_network: { strict: true }
            })
            expect(strictTools.render_chart).toBe(tools.render_chart)
        }
    )
})
