import { z } from "zod"

export const NATIVE_CHART_TOOL_NAME = "render_chart"

const chartKeySchema = z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Use simple alphanumeric data keys")

const chartValueSchema = z.union([z.string().max(120), z.number().finite(), z.null()])

export const nativeChartSchema = z
    .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(280).optional(),
        type: z.enum(["line", "bar", "area", "scatter"]),
        xKey: chartKeySchema.describe("The data field used for the horizontal axis."),
        xScale: z
            .enum(["category", "linear"])
            .optional()
            .default("category")
            .describe("Use linear for sampled mathematical functions and other numeric x axes."),
        xLabel: z.string().trim().max(80).optional(),
        yLabel: z.string().trim().max(80).optional(),
        showLegend: z.boolean().optional().default(true),
        stacked: z.boolean().optional().default(false),
        series: z
            .array(
                z.object({
                    key: chartKeySchema,
                    label: z.string().trim().min(1).max(80)
                })
            )
            .min(1)
            .max(5),
        data: z.array(z.record(z.string(), chartValueSchema)).min(1).max(500)
    })
    .superRefine((chart, ctx) => {
        const seriesKeys = new Set<string>()

        for (const [index, series] of chart.series.entries()) {
            if (series.key === chart.xKey) {
                ctx.addIssue({
                    code: "custom",
                    path: ["series", index, "key"],
                    message: "A series key cannot also be the x-axis key"
                })
            }
            if (seriesKeys.has(series.key)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["series", index, "key"],
                    message: "Series keys must be unique"
                })
            }
            seriesKeys.add(series.key)
        }

        for (const [rowIndex, row] of chart.data.entries()) {
            const xValue = row[chart.xKey]
            if (typeof xValue !== "string" && typeof xValue !== "number") {
                ctx.addIssue({
                    code: "custom",
                    path: ["data", rowIndex, chart.xKey],
                    message: "Every row must have a string or numeric x-axis value"
                })
            }
            if (
                (chart.type === "scatter" || chart.xScale === "linear") &&
                typeof xValue !== "number"
            ) {
                ctx.addIssue({
                    code: "custom",
                    path: ["data", rowIndex, chart.xKey],
                    message: "Scatter charts and linear x scales require numeric x-axis values"
                })
            }

            for (const series of chart.series) {
                const value = row[series.key]
                if (value !== null && typeof value !== "number") {
                    ctx.addIssue({
                        code: "custom",
                        path: ["data", rowIndex, series.key],
                        message: "Series values must be numbers or null"
                    })
                }
            }
        }
    })

export type NativeChart = z.infer<typeof nativeChartSchema>

export const nativeChartToolOutputSchema = z.object({
    success: z.literal(true),
    kind: z.literal("native_chart"),
    chart: nativeChartSchema
})

export type NativeChartToolOutput = z.infer<typeof nativeChartToolOutputSchema>

export const getNativeChartFromToolOutput = (output: unknown): NativeChart | null => {
    const parsed = nativeChartToolOutputSchema.safeParse(output)
    return parsed.success ? parsed.data.chart : null
}
