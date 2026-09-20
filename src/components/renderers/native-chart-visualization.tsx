import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent
} from "@/components/ui/chart"
import { type NativeChart, getBoundedNumericDomain } from "@/lib/native-chart"
import { BarChart3 } from "lucide-react"
import { memo } from "react"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    Scatter,
    ScatterChart,
    XAxis,
    YAxis
} from "recharts"
import {
    NativeVisualizationShell,
    type NativeVisualizationSize
} from "./native-visualization-shell"

const SERIES_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)"
]

const EXPANDED_CHART_INSET = 16

const axisProps = {
    tickLine: false,
    axisLine: false,
    tickMargin: 8
} as const

const getAxisLabel = ({ value, angle }: { value?: string; angle?: number }) =>
    value
        ? {
              value,
              angle,
              position: angle ? ("insideLeft" as const) : ("insideBottom" as const),
              offset: angle ? 0 : -4,
              style: { fill: "var(--muted-foreground)", fontSize: 12 }
          }
        : undefined

const NativeChartPlot = ({ chart }: { chart: NativeChart }) => {
    const margin = { left: 8, right: 8, bottom: chart.xLabel ? 16 : 0 }
    const usesNumericXAxis = chart.type === "scatter" || chart.xScale === "linear"
    const numericXValues = usesNumericXAxis
        ? chart.data.flatMap((row) =>
              typeof row[chart.xKey] === "number" ? [row[chart.xKey] as number] : []
          )
        : []
    const numericXDomain = usesNumericXAxis ? getBoundedNumericDomain(numericXValues) : null
    const plotData = usesNumericXAxis
        ? [...chart.data].sort(
              (left, right) => (left[chart.xKey] as number) - (right[chart.xKey] as number)
          )
        : chart.data
    const xAxisType = usesNumericXAxis ? "number" : "category"
    const numericXAxisProps =
        usesNumericXAxis && numericXDomain
            ? {
                  domain: numericXDomain,
                  allowDataOverflow: true,
                  allowDecimals: !numericXValues.every(Number.isInteger),
                  tickCount: Math.min(6, new Set(numericXValues).size),
                  padding: { left: 12, right: 12 }
              }
            : {}

    if (usesNumericXAxis && !numericXDomain) {
        return null
    }

    if (chart.type === "bar") {
        return (
            <BarChart data={plotData} margin={margin}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                    {...axisProps}
                    dataKey={chart.xKey}
                    type={xAxisType}
                    {...numericXAxisProps}
                    label={getAxisLabel({ value: chart.xLabel })}
                />
                <YAxis
                    {...axisProps}
                    type="number"
                    width={48}
                    label={getAxisLabel({ value: chart.yLabel, angle: -90 })}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {chart.showLegend && <ChartLegend content={<ChartLegendContent />} />}
                {chart.series.map((series) => (
                    <Bar
                        key={series.key}
                        dataKey={series.key}
                        name={series.label}
                        fill={`var(--color-${series.key})`}
                        stackId={chart.stacked ? "value" : undefined}
                        isAnimationActive={false}
                    />
                ))}
            </BarChart>
        )
    }

    if (chart.type === "area") {
        return (
            <AreaChart data={plotData} margin={margin}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                    {...axisProps}
                    dataKey={chart.xKey}
                    type={xAxisType}
                    {...numericXAxisProps}
                    label={getAxisLabel({ value: chart.xLabel })}
                />
                <YAxis
                    {...axisProps}
                    type="number"
                    width={48}
                    label={getAxisLabel({ value: chart.yLabel, angle: -90 })}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {chart.showLegend && <ChartLegend content={<ChartLegendContent />} />}
                {chart.series.map((series) => (
                    <Area
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={series.label}
                        stroke={`var(--color-${series.key})`}
                        fill={`var(--color-${series.key})`}
                        fillOpacity={0.18}
                        stackId={chart.stacked ? "value" : undefined}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
            </AreaChart>
        )
    }

    if (chart.type === "scatter") {
        return (
            <ScatterChart margin={margin}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                    {...axisProps}
                    dataKey="x"
                    type="number"
                    {...numericXAxisProps}
                    label={getAxisLabel({ value: chart.xLabel })}
                />
                <YAxis
                    {...axisProps}
                    dataKey="y"
                    type="number"
                    width={48}
                    label={getAxisLabel({ value: chart.yLabel, angle: -90 })}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {chart.showLegend && <ChartLegend content={<ChartLegendContent />} />}
                {chart.series.map((series) => (
                    <Scatter
                        key={series.key}
                        name={series.label}
                        data={plotData.map((row) => ({
                            x: row[chart.xKey],
                            y: row[series.key]
                        }))}
                        fill={`var(--color-${series.key})`}
                        isAnimationActive={false}
                    />
                ))}
            </ScatterChart>
        )
    }

    return (
        <LineChart data={plotData} margin={margin}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
                {...axisProps}
                dataKey={chart.xKey}
                type={xAxisType}
                {...numericXAxisProps}
                label={getAxisLabel({ value: chart.xLabel })}
            />
            <YAxis
                {...axisProps}
                type="number"
                width={48}
                label={getAxisLabel({ value: chart.yLabel, angle: -90 })}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {chart.showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {chart.series.map((series) => (
                <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={`var(--color-${series.key})`}
                    strokeWidth={2}
                    dot={chart.data.length <= 40}
                    connectNulls={false}
                    isAnimationActive={false}
                />
            ))}
        </LineChart>
    )
}

const NativeChartVisualization = ({
    chart,
    expanded,
    size
}: {
    chart: NativeChart
    expanded: boolean
    size?: NativeVisualizationSize
}) => {
    const config = Object.fromEntries(
        chart.series.map((series, index) => [
            series.key,
            { label: series.label, color: SERIES_COLORS[index] }
        ])
    ) satisfies ChartConfig

    const width = expanded ? Math.max(0, (size?.width ?? 0) - EXPANDED_CHART_INSET) : "100%"
    const height = expanded ? Math.max(0, (size?.height ?? 0) - EXPANDED_CHART_INSET) : 300

    return (
        <div
            className={expanded ? "overflow-hidden" : "px-2 py-4 sm:px-4"}
            style={
                expanded && size
                    ? {
                          width: size.width,
                          height: size.height,
                          paddingTop: EXPANDED_CHART_INSET,
                          paddingLeft: EXPANDED_CHART_INSET
                      }
                    : undefined
            }
        >
            <ChartContainer
                config={config}
                className="aspect-auto w-full overflow-hidden"
                style={{ height }}
                responsiveContainerProps={{
                    width,
                    height,
                    initialDimension: { width: size?.width ?? 800, height: height || 300 },
                    minWidth: 0
                }}
            >
                <NativeChartPlot chart={chart} />
            </ChartContainer>
        </div>
    )
}

export const NativeChartRenderer = memo(({ chart }: { chart: NativeChart }) => (
    <NativeVisualizationShell
        kind="chart"
        title={chart.title}
        description={chart.description}
        icon={<BarChart3 className="size-4" />}
        dataAttribute="data-native-chart"
        renderVisualization={(expanded, size) => (
            <NativeChartVisualization chart={chart} expanded={expanded} size={size} />
        )}
    />
))

NativeChartRenderer.displayName = "NativeChartRenderer"
