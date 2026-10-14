import {
    type ChartAxisDomain,
    ChartPlot,
    type ChartPlotStyle,
    type ChartReferenceLine,
    seriesSwatchColor,
    useThemeRadiusPx
} from "@/components/renderers/chart-plot"
import { SpotlightTooltip } from "@/components/renderers/spotlight-tooltip"
import { SpotlightChips, useSpotlightFilter } from "@/components/renderers/spotlight-frame"
import type { NativeChart } from "@/lib/native-chart"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

export type ChartSeries = string | { key: string; label?: string; axis?: "left" | "right" }

export type ChartProps = {
    type?: NativeChart["type"]
    data: Record<string, unknown>[]
    /** The data field for the horizontal axis. */
    x: string
    /** Up to five series, each a data field or `{ key, label, axis }`. */
    series: ChartSeries[]
    height?: number
    xScale?: NativeChart["xScale"]
    xLabel?: string
    yLabel?: string
    yLabelRight?: string
    /** Minimum y range, e.g. `[0, 100]`; data outside it still extends the axis. */
    yDomain?: ChartAxisDomain
    yDomainRight?: ChartAxisDomain
    references?: ChartReferenceLine[]
    stacked?: boolean
    legend?: boolean
    /** Ring every point; defaults on for short series. */
    dots?: boolean
    className?: string
}

const MAX_SERIES = 5

const toPlotValue = (value: unknown) => {
    const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    return typeof number === "number" && Number.isFinite(number) ? number : null
}

/**
 * Shapes app data for the shared plot. Series get synthetic keys because the plot names
 * CSS variables after them, and models key data by display names like "Blood Glucose".
 */
export const buildAppChart = ({
    type = "line",
    data,
    x,
    series,
    xScale,
    xLabel,
    yLabel,
    stacked = false,
    legend = true
}: ChartProps) => {
    const normalized = series.slice(0, MAX_SERIES).map((entry, index) => {
        const source = typeof entry === "string" ? { key: entry } : entry
        return {
            key: `s${index}`,
            field: source.key,
            label: source.label ?? source.key,
            axis: source.axis ?? "left"
        }
    })
    const numericX = data.length > 0 && data.every((row) => typeof row[x] === "number")
    const rows = data.map((row) => {
        const xValue = row[x]
        const plotRow: NativeChart["data"][number] = {
            [x]: typeof xValue === "number" ? xValue : String(xValue ?? "")
        }
        for (const series of normalized) plotRow[series.key] = toPlotValue(row[series.field])
        return plotRow
    })

    const chart: NativeChart = {
        title: "",
        type,
        xKey: x,
        xScale: type === "scatter" && numericX ? "linear" : (xScale ?? "category"),
        xLabel,
        yLabel,
        showLegend: legend,
        stacked,
        series: normalized.map(({ key, label }) => ({ key, label })),
        data: rows
    }
    const rightAxisKeys = new Set(
        normalized.filter((series) => series.axis === "right").map((series) => series.key)
    )
    return { chart, rightAxisKeys }
}

export function Chart(props: ChartProps) {
    const { height = 260, yLabelRight, yDomain, yDomainRight, references, dots, className } = props
    // Keyed on the props object, which only changes when the parent re-renders, so hovering
    // chips never hands Recharts new rows (and a replayed animation).
    const { chart, rightAxisKeys } = useMemo(() => buildAppChart(props), [props])
    const { hiddenKeys, focusKey, toggle, setFocusKey } = useSpotlightFilter(chart.series.length)
    const barRadius = useThemeRadiusPx("md")
    const showDots = dots ?? chart.data.length <= 24

    const plotStyle: ChartPlotStyle = {
        grid: "solid",
        yAxis: "left",
        lineWidth: 2.5,
        lineDots: showDots ? "hollow" : "none",
        endDot: !showDots,
        lineShade: true,
        areaFill: "gradient",
        barRadius,
        barMaxSize: 36,
        barGradient: true,
        animate: true,
        cursor: chart.type === "bar" ? "band" : "line",
        tooltip: (tooltipProps) => <SpotlightTooltip props={tooltipProps} chart={chart} />
    }

    return (
        <div className={cn("min-w-0", className)}>
            {chart.series.length > 1 && chart.showLegend && (
                <SpotlightChips
                    className="px-0 pt-0 pb-2"
                    chips={chart.series.map((series) => ({
                        key: series.key,
                        label: series.label,
                        color: seriesSwatchColor(chart, series.key)
                    }))}
                    hiddenKeys={hiddenKeys}
                    onToggle={toggle}
                    onFocusChange={setFocusKey}
                />
            )}
            <div style={{ height }}>
                <ChartPlot
                    chart={chart}
                    plotStyle={plotStyle}
                    hiddenKeys={hiddenKeys}
                    focusKey={focusKey}
                    rightAxisKeys={rightAxisKeys}
                    rightAxisLabel={yLabelRight}
                    yDomains={{ left: yDomain, right: yDomainRight }}
                    referenceLines={references}
                />
            </div>
        </div>
    )
}
