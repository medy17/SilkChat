import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { type NativeChart, getBoundedNumericDomain } from "@/lib/native-chart"
import { cn } from "@/lib/utils"
import { type ReactElement, type ReactNode, useId, useLayoutEffect, useMemo, useState } from "react"
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    LabelList,
    Line,
    Scatter,
    ScatterChart,
    Tooltip,
    type TooltipContentProps,
    type TooltipValueType,
    XAxis,
    YAxis
} from "recharts"

export const SERIES_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)"
]

export type PlotTooltipProps = TooltipContentProps<TooltipValueType, string | number>

export type ChartRow = NativeChart["data"][number]

export const seriesColor = (key: string) => `var(--color-${key})`

/** The series color outside the chart container, where `--color-<key>` is not defined. */
export const seriesSwatchColor = (chart: NativeChart, key: string) =>
    SERIES_COLORS[chart.series.findIndex((series) => series.key === key)] ?? SERIES_COLORS[0]

export const buildChartConfig = (chart: NativeChart) =>
    Object.fromEntries(
        chart.series.map((series, index) => [
            series.key,
            { label: series.label, color: SERIES_COLORS[index] }
        ])
    ) satisfies ChartConfig

const compactFormatter = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1
})

const scientificFormatter = new Intl.NumberFormat(undefined, {
    notation: "scientific",
    maximumFractionDigits: 2
})

export const formatValue = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "–"
    const magnitude = Math.abs(value)
    if (magnitude >= 10_000) return compactFormatter.format(value)
    if (magnitude >= 1 || magnitude === 0) {
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    // Below 1, digits after the decimal point say nothing about precision: 0.0001 and
    // 0.0002 must not both round to 0.
    if (magnitude < 1e-4) return scientificFormatter.format(value)
    return value.toLocaleString(undefined, { maximumSignificantDigits: 3 })
}

export const formatX = (value: unknown) =>
    typeof value === "number" ? formatValue(value) : String(value ?? "")

export const numericValue = (row: ChartRow | undefined, key: string) => {
    const value = row?.[key]
    return typeof value === "number" ? value : null
}

export const usesNumericXAxis = (chart: NativeChart) =>
    chart.type === "scatter" || chart.xScale === "linear"

export const getPlotRows = (chart: NativeChart): ChartRow[] =>
    usesNumericXAxis(chart)
        ? [...chart.data].sort(
              (left, right) => (left[chart.xKey] as number) - (right[chart.xKey] as number)
          )
        : chart.data

export const getLastRow = (rows: ChartRow[], key: string) => {
    for (let index = rows.length - 1; index >= 0; index--) {
        if (typeof rows[index][key] === "number") return rows[index]
    }
    return undefined
}

export const getSeriesExtent = (chart: NativeChart) => {
    const values = chart.data.flatMap((row) =>
        chart.series.flatMap((series) => {
            const value = row[series.key]
            return typeof value === "number" ? [value] : []
        })
    )
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null
}

/** Round-number ticks inside the domain, so numeric axes read 0, 2, 4 rather than 2.72. */
export const getNiceTicks = ([min, max]: [number, number], target = 6) => {
    const range = max - min
    if (!(range > 0) || !Number.isFinite(range)) return undefined
    const magnitude = 10 ** Math.floor(Math.log10(range / (target - 1)))
    const steps = [0.1, 1, 10].flatMap((scale) =>
        [1, 2, 2.5, 5].map((factor) => factor * scale * magnitude)
    )
    const countFor = (step: number) => Math.floor(max / step) - Math.ceil(min / step) + 1
    const step = steps.find((candidate) => countFor(candidate) <= target + 1)
    if (step === undefined) return undefined
    const start = Math.ceil(min / step) * step
    const ticks = Array.from({ length: countFor(step) }, (_, index) =>
        Number((start + index * step).toPrecision(12))
    )
    // At extreme magnitudes the step falls below float precision and ticks collapse onto
    // each other; the axis defaults handle those domains.
    const distinct = ticks.every((tick, index) => index === 0 || tick > ticks[index - 1])
    return ticks.length >= 2 && distinct ? ticks : undefined
}

const FILL_PEAK_OPACITY = 0.42

export type FillGradientStop = { offset: number; opacity: number }

/**
 * Stops for a fill that fades to nothing where it meets its baseline. Recharts fills toward
 * zero when values straddle it, otherwise toward the axis edge, and a gradient spans the
 * fill's own bounding box, so the baseline's offset follows from the values alone. Opacity
 * scales with distance from the baseline on both sides, so signed series (tan x) shade
 * symmetrically instead of being cut off at zero.
 */
export const getFillGradientStops = (values: readonly number[]): FillGradientStop[] => {
    const finite = values.filter(Number.isFinite)
    const max = Math.max(...finite)
    const min = Math.min(...finite)
    if (!finite.length || min >= 0) {
        return [
            { offset: 0, opacity: FILL_PEAK_OPACITY },
            { offset: 1, opacity: 0 }
        ]
    }
    if (max <= 0) {
        return [
            { offset: 0, opacity: 0 },
            { offset: 1, opacity: FILL_PEAK_OPACITY }
        ]
    }
    const extent = Math.max(max, -min)
    return [
        { offset: 0, opacity: (FILL_PEAK_OPACITY * max) / extent },
        { offset: max / (max - min), opacity: 0 },
        { offset: 1, opacity: (FILL_PEAK_OPACITY * -min) / extent }
    ]
}

// Direct end labels only work when the series separate at the right edge. When any two
// endpoints sit within 8% of the value range, fall back to the legend instead of nudging.
export const canUseEndLabels = (chart: NativeChart, visibleKeys: string[]) => {
    if (chart.type !== "line" || chart.stacked || visibleKeys.length < 2) return false
    if (visibleKeys.length > 4) return false
    const extent = getSeriesExtent(chart)
    if (!extent || extent.max === extent.min) return false
    const rows = getPlotRows(chart)
    const endpoints = visibleKeys
        .map((key) => numericValue(getLastRow(rows, key), key))
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right)
    const range = extent.max - extent.min
    return endpoints.every(
        (value, index) => index === 0 || value - endpoints[index - 1] > range * 0.08
    )
}

// Mirrors the @theme radius scale in globals.css, in case a token was not emitted.
const RADIUS_FALLBACKS = {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
    xl: "calc(var(--radius) + 4px)"
} as const

/** Resolves a theme radius token to pixels so SVG marks can follow `--radius`. */
export const useThemeRadiusPx = (token: keyof typeof RADIUS_FALLBACKS) => {
    const [radius, setRadius] = useState(0)

    useLayoutEffect(() => {
        const probe = document.createElement("div")
        probe.style.cssText = `position:absolute;visibility:hidden;border-top-left-radius:var(--radius-${token}, ${RADIUS_FALLBACKS[token]})`
        document.body.appendChild(probe)

        const measure = () => {
            const next = Number.parseFloat(getComputedStyle(probe).borderTopLeftRadius) || 0
            setRadius(Math.max(0, next))
        }
        measure()

        const observer = new MutationObserver(measure)
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"]
        })
        return () => {
            observer.disconnect()
            probe.remove()
        }
    }, [token])

    return radius
}

export type TooltipRow = { key: string; label: string; value: number | null }

export const readTooltip = (
    props: PlotTooltipProps,
    chart: NativeChart
): { title: string; rows: TooltipRow[] } | null => {
    if (!props.active || !props.payload?.length) return null
    const labels = new Map(chart.series.map((series) => [series.key, series.label]))

    if (chart.type === "scatter") {
        const point = props.payload[0]?.payload as
            | { x: number; y: number; seriesKey: string }
            | undefined
        if (!point) return null
        return {
            title: `${chart.xLabel ?? chart.xKey} ${formatValue(point.x)}`,
            rows: [
                {
                    key: point.seriesKey,
                    label: labels.get(point.seriesKey) ?? point.seriesKey,
                    value: point.y
                }
            ]
        }
    }

    const seen = new Set<string>()
    const rows = props.payload.flatMap((item) => {
        const key = String(item.dataKey ?? "")
        if (!labels.has(key) || seen.has(key)) return []
        seen.add(key)
        return [
            {
                key,
                label: labels.get(key) ?? key,
                value: typeof item.value === "number" ? item.value : null
            }
        ]
    })
    return { title: formatX(props.label), rows }
}

export type ChartPlotStyle = {
    grid: "solid" | "dotted" | "none"
    yAxis: "left" | "right" | "inline"
    xAxisLine?: boolean
    mono?: boolean
    lineWidth: number
    /** "hollow" draws every point as a ring when the series is short enough. */
    lineDots: "none" | "hollow"
    endDot?: boolean
    endLabels?: boolean
    lineShade?: boolean
    areaFill: "wash" | "gradient" | "solid"
    barRadius: number
    barMaxSize: number
    barGradient?: boolean
    horizontalBars?: boolean
    barValueLabels?: boolean
    animate?: boolean
    cursor: "line" | "band"
    tooltip?: (props: PlotTooltipProps) => ReactNode
    /** Color of the gaps and rings that separate marks; match what the plot sits on. */
    surface?: string
}

type ChartPlotProps = {
    chart: NativeChart
    plotStyle: ChartPlotStyle
    height?: number
    className?: string
    hiddenKeys?: ReadonlySet<string>
    focusKey?: string | null
    onActiveRowChange?: (row: ChartRow | null) => void
}

const tickStyle = (mono?: boolean) => ({
    fontSize: 11,
    fontFamily: mono ? "var(--font-mono)" : undefined,
    fill: "var(--muted-foreground)"
})

export function ChartPlot({
    chart,
    plotStyle,
    height,
    className,
    hiddenKeys,
    focusKey,
    onActiveRowChange
}: ChartPlotProps) {
    const gradientPrefix = useId().replace(/:/g, "")
    const surface = plotStyle.surface ?? "var(--card)"
    const config = useMemo(() => buildChartConfig(chart), [chart])
    const rows = useMemo(() => getPlotRows(chart), [chart])
    const visibleSeries = chart.series.filter((series) => !hiddenKeys?.has(series.key))
    const visibleKeys = visibleSeries.map((series) => series.key)
    const numericX = usesNumericXAxis(chart)
    const xValues = numericX
        ? rows.flatMap((row) =>
              typeof row[chart.xKey] === "number" ? [row[chart.xKey] as number] : []
          )
        : []
    const xDomain = numericX ? getBoundedNumericDomain(xValues) : null
    const xTicks = xDomain ? getNiceTicks(xDomain) : undefined
    const showEndLabels = plotStyle.endLabels && canUseEndLabels(chart, visibleKeys)
    const longestLabel = Math.max(...visibleSeries.map((series) => series.label.length), 0)
    const animation = {
        isAnimationActive: Boolean(plotStyle.animate),
        animationDuration: 650,
        animationEasing: "ease-out" as const
    }

    const opacityFor = (key: string) => (focusKey && focusKey !== key ? 0.18 : 1)
    const gradientId = (key: string) => `${gradientPrefix}-${key}`

    const margin = {
        top: plotStyle.yAxis === "inline" ? 20 : 12,
        right: showEndLabels ? Math.min(160, longestLabel * 6.6 + 22) : 12,
        bottom: 4,
        left: plotStyle.yAxis === "inline" ? 0 : 4
    }

    const handleMove = (state: { isTooltipActive: boolean; activeTooltipIndex?: unknown }) => {
        if (!onActiveRowChange) return
        const index = state.isTooltipActive ? Number(state.activeTooltipIndex) : Number.NaN
        onActiveRowChange(Number.isInteger(index) ? (rows[index] ?? null) : null)
    }
    const hoverHandlers = onActiveRowChange
        ? { onMouseMove: handleMove, onMouseLeave: () => onActiveRowChange(null) }
        : {}

    const grid =
        plotStyle.grid === "none" ? null : (
            <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray={plotStyle.grid === "dotted" ? "1 4" : undefined}
                strokeLinecap="round"
            />
        )

    const xAxisLabel = chart.xLabel
        ? {
              value: chart.xLabel,
              position: "insideBottom" as const,
              offset: 0,
              style: { ...tickStyle(plotStyle.mono), fontSize: 11 }
          }
        : undefined

    const xAxis = (
        <XAxis
            dataKey={chart.type === "scatter" ? "x" : chart.xKey}
            type={numericX ? "number" : "category"}
            height={chart.xLabel ? 46 : 30}
            tickLine={false}
            axisLine={
                plotStyle.xAxisLine ? { stroke: "var(--foreground)", strokeOpacity: 0.35 } : false
            }
            tickMargin={8}
            tick={tickStyle(plotStyle.mono)}
            tickFormatter={formatX}
            interval="preserveStartEnd"
            minTickGap={18}
            label={xAxisLabel}
            {...(numericX && xDomain
                ? {
                      domain: xDomain,
                      allowDecimals: !xValues.every(Number.isInteger),
                      ...(xTicks
                          ? { ticks: xTicks }
                          : { tickCount: Math.min(7, new Set(xValues).size) }),
                      padding: { left: 8, right: 8 }
                  }
                : {})}
        />
    )

    const rightAxis = plotStyle.yAxis === "right"
    const yAxisLabel = chart.yLabel
        ? {
              value: chart.yLabel,
              angle: rightAxis ? 90 : -90,
              position: rightAxis ? ("insideRight" as const) : ("insideLeft" as const),
              style: { ...tickStyle(plotStyle.mono), textAnchor: "middle" as const }
          }
        : undefined

    const yAxis =
        plotStyle.yAxis === "inline" ? (
            <YAxis
                type="number"
                dataKey={chart.type === "scatter" ? "y" : undefined}
                mirror
                tickLine={false}
                axisLine={false}
                tickCount={5}
                tickFormatter={formatValue}
                tick={({ x, y, payload }) => (
                    <text x={x} y={y} dy={-6} textAnchor="start" style={tickStyle(plotStyle.mono)}>
                        {formatValue(payload.value as number)}
                    </text>
                )}
                domain={chart.type === "scatter" ? ["auto", "auto"] : undefined}
            />
        ) : (
            <YAxis
                type="number"
                dataKey={chart.type === "scatter" ? "y" : undefined}
                orientation={plotStyle.yAxis}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                width={yAxisLabel ? 62 : 44}
                tickCount={5}
                tick={tickStyle(plotStyle.mono)}
                tickFormatter={formatValue}
                label={yAxisLabel}
                domain={chart.type === "scatter" ? ["auto", "auto"] : undefined}
            />
        )

    const cursor =
        plotStyle.cursor === "band"
            ? { fill: "var(--foreground)", fillOpacity: 0.05 }
            : { stroke: "var(--foreground)", strokeOpacity: 0.3, strokeWidth: 1 }

    const tooltip = (
        <Tooltip
            cursor={cursor}
            content={plotStyle.tooltip ?? (() => null)}
            isAnimationActive={false}
            wrapperStyle={{ outline: "none", zIndex: 10 }}
        />
    )

    const gradients = (
        <defs>
            {visibleSeries.map((series) => (
                <linearGradient
                    key={series.key}
                    id={gradientId(series.key)}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                >
                    {getFillGradientStops(
                        rows.flatMap((row) => {
                            const value = row[series.key]
                            return typeof value === "number" ? [value] : []
                        })
                    ).map((stop) => (
                        <stop
                            key={stop.offset}
                            offset={stop.offset}
                            stopColor={seriesColor(series.key)}
                            stopOpacity={stop.opacity}
                        />
                    ))}
                </linearGradient>
            ))}
        </defs>
    )

    const renderEndLabel =
        (key: string, label: string) => (props: { x?: unknown; y?: unknown; index?: unknown }) => {
            const lastRow = getLastRow(rows, key)
            if (!lastRow || rows[props.index as number] !== lastRow) return null
            const x = Number(props.x)
            const y = Number(props.y)
            return (
                <text
                    x={x + 10}
                    y={y}
                    dy={4}
                    style={{ fontSize: 12, fill: "var(--foreground)", fontWeight: 500 }}
                >
                    {label}
                </text>
            )
        }

    let plot: ReactElement

    if (chart.type === "scatter") {
        plot = (
            <ScatterChart margin={margin} {...hoverHandlers}>
                {grid}
                {xAxis}
                {yAxis}
                {tooltip}
                {visibleSeries.map((series) => (
                    <Scatter
                        key={series.key}
                        name={series.label}
                        data={rows.flatMap((row) =>
                            typeof row[series.key] === "number"
                                ? [
                                      {
                                          x: row[chart.xKey],
                                          y: row[series.key],
                                          seriesKey: series.key
                                      }
                                  ]
                                : []
                        )}
                        fill={seriesColor(series.key)}
                        stroke={surface}
                        strokeWidth={2}
                        fillOpacity={opacityFor(series.key)}
                        strokeOpacity={opacityFor(series.key)}
                        {...animation}
                    />
                ))}
            </ScatterChart>
        )
    } else if (chart.type === "bar") {
        const horizontal =
            plotStyle.horizontalBars && chart.series.length === 1 && rows.length <= 14 && !numericX
        const longestCategory = Math.max(...rows.map((row) => formatX(row[chart.xKey]).length), 0)
        const r = plotStyle.barRadius
        const lastKey = visibleKeys.at(-1)
        const radiusFor = (key: string): [number, number, number, number] => {
            if (chart.stacked && key !== lastKey) return [0, 0, 0, 0]
            return horizontal ? [0, r, r, 0] : [r, r, 0, 0]
        }

        plot = (
            <BarChart
                data={rows}
                margin={horizontal ? { ...margin, right: 48, left: 4 } : margin}
                layout={horizontal ? "vertical" : "horizontal"}
                barGap={2}
                barCategoryGap={horizontal ? "22%" : "18%"}
                {...hoverHandlers}
            >
                {plotStyle.barGradient && (
                    <defs>
                        {visibleSeries.map((series) => (
                            <linearGradient
                                key={series.key}
                                id={gradientId(series.key)}
                                x1="0"
                                y1="0"
                                x2={horizontal ? "1" : "0"}
                                y2={horizontal ? "0" : "1"}
                            >
                                <stop
                                    offset="0%"
                                    stopColor={seriesColor(series.key)}
                                    stopOpacity={horizontal ? 0.55 : 1}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={seriesColor(series.key)}
                                    stopOpacity={horizontal ? 1 : 0.55}
                                />
                            </linearGradient>
                        ))}
                    </defs>
                )}
                {horizontal ? (
                    <>
                        {plotStyle.grid !== "none" && (
                            <CartesianGrid
                                horizontal={false}
                                stroke="var(--border)"
                                strokeDasharray={plotStyle.grid === "dotted" ? "1 4" : undefined}
                            />
                        )}
                        <XAxis type="number" hide domain={[0, "dataMax"]} />
                        <YAxis
                            type="category"
                            dataKey={chart.xKey}
                            tickLine={false}
                            axisLine={
                                plotStyle.xAxisLine
                                    ? { stroke: "var(--foreground)", strokeOpacity: 0.35 }
                                    : false
                            }
                            width={Math.min(140, longestCategory * 6.8 + 12)}
                            tick={{ ...tickStyle(plotStyle.mono), fill: "var(--foreground)" }}
                            interval={0}
                        />
                    </>
                ) : (
                    <>
                        {grid}
                        {xAxis}
                        {yAxis}
                    </>
                )}
                {tooltip}
                {visibleSeries.map((series) => (
                    <Bar
                        key={series.key}
                        dataKey={series.key}
                        name={series.label}
                        fill={
                            plotStyle.barGradient
                                ? `url(#${gradientId(series.key)})`
                                : seriesColor(series.key)
                        }
                        fillOpacity={opacityFor(series.key)}
                        radius={radiusFor(series.key)}
                        maxBarSize={plotStyle.barMaxSize}
                        stackId={chart.stacked ? "value" : undefined}
                        stroke={chart.stacked ? surface : undefined}
                        strokeWidth={chart.stacked ? 1 : undefined}
                        {...animation}
                    >
                        {plotStyle.barValueLabels &&
                            visibleSeries.length === 1 &&
                            rows.length <= 14 && (
                                <LabelList
                                    dataKey={series.key}
                                    position={horizontal ? "right" : "top"}
                                    offset={6}
                                    formatter={(value) => formatValue(value as number)}
                                    style={{
                                        ...tickStyle(plotStyle.mono),
                                        fill: "var(--foreground)",
                                        fontWeight: 500
                                    }}
                                />
                            )}
                    </Bar>
                ))}
            </BarChart>
        )
    } else {
        const isArea = chart.type === "area"
        const showDots = plotStyle.lineDots === "hollow" && rows.length <= 40

        plot = (
            <ComposedChart data={rows} margin={margin} {...hoverHandlers}>
                {gradients}
                {grid}
                {xAxis}
                {yAxis}
                {tooltip}
                {visibleSeries.map((series) => {
                    const color = seriesColor(series.key)
                    const opacity = opacityFor(series.key)

                    if (isArea) {
                        const stackedSolid = plotStyle.areaFill === "solid" && chart.stacked
                        return (
                            <Area
                                key={series.key}
                                type="monotone"
                                dataKey={series.key}
                                name={series.label}
                                stackId={chart.stacked ? "value" : undefined}
                                stroke={stackedSolid ? surface : color}
                                strokeWidth={stackedSolid ? 1.5 : plotStyle.lineWidth}
                                strokeOpacity={opacity}
                                fill={
                                    plotStyle.areaFill === "gradient"
                                        ? `url(#${gradientId(series.key)})`
                                        : color
                                }
                                fillOpacity={
                                    (plotStyle.areaFill === "gradient"
                                        ? 1
                                        : stackedSolid
                                          ? 0.88
                                          : chart.stacked
                                            ? 0.3
                                            : 0.1) * opacity
                                }
                                activeDot={{ r: 4, stroke: surface, strokeWidth: 2 }}
                                connectNulls={false}
                                {...animation}
                            />
                        )
                    }

                    return [
                        plotStyle.lineShade ? (
                            <Area
                                key={`${series.key}-shade`}
                                type="monotone"
                                dataKey={series.key}
                                tooltipType="none"
                                stroke="none"
                                fill={`url(#${gradientId(series.key)})`}
                                fillOpacity={focusKey && focusKey !== series.key ? 0 : 0.55}
                                activeDot={false}
                                connectNulls={false}
                                {...animation}
                            />
                        ) : null,
                        <Line
                            key={series.key}
                            type="monotone"
                            dataKey={series.key}
                            name={series.label}
                            stroke={color}
                            strokeWidth={plotStyle.lineWidth}
                            strokeOpacity={opacity}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            dot={
                                showDots
                                    ? { r: 2.5, fill: surface, strokeWidth: 1.5 }
                                    : plotStyle.endDot
                                      ? (props: { cx?: number; cy?: number; index?: number }) => {
                                            const isLast =
                                                rows[props.index ?? -1] ===
                                                getLastRow(rows, series.key)
                                            return (
                                                <circle
                                                    key={`${series.key}-${props.index}`}
                                                    cx={props.cx}
                                                    cy={props.cy}
                                                    r={isLast ? 4 : 0}
                                                    fill={color}
                                                    fillOpacity={opacity}
                                                    stroke={surface}
                                                    strokeWidth={2}
                                                />
                                            )
                                        }
                                      : false
                            }
                            activeDot={{ r: 4.5, stroke: surface, strokeWidth: 2 }}
                            connectNulls={false}
                            {...animation}
                        >
                            {showEndLabels && (
                                <LabelList
                                    dataKey={series.key}
                                    content={renderEndLabel(series.key, series.label)}
                                />
                            )}
                        </Line>
                    ]
                })}
            </ComposedChart>
        )
    }

    return (
        <ChartContainer
            config={config}
            className={cn("aspect-auto h-full w-full", className)}
            style={height ? { height } : undefined}
            responsiveContainerProps={{ width: "100%", height: "100%", minWidth: 0 }}
        >
            {plot}
        </ChartContainer>
    )
}
