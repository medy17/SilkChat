import type { NativeChart } from "@/lib/native-chart"
import { type PlotTooltipProps, formatValue, readTooltip, seriesSwatchColor } from "./chart-plot"

export function SpotlightTooltip({
    props,
    chart
}: {
    props: PlotTooltipProps
    chart: NativeChart
}) {
    const content = readTooltip(props, chart)
    if (!content) return null
    const rows = chart.stacked
        ? content.rows
        : [...content.rows].sort((left, right) => (right.value ?? 0) - (left.value ?? 0))
    const total = chart.stacked ? rows.reduce((sum, row) => sum + (row.value ?? 0), 0) : null

    return (
        <div className="spotlight-glass min-w-40 rounded-[var(--radius-lg)] px-3 py-2.5 text-xs">
            <p className="mb-1.5 font-semibold text-foreground">{content.title}</p>
            <div className="grid gap-1">
                {rows.map((row) => (
                    <div key={row.key} className="flex items-center gap-2">
                        <span
                            aria-hidden
                            className="h-3.5 w-1 rounded-[var(--radius-sm)]"
                            style={{ background: seriesSwatchColor(chart, row.key) }}
                        />
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="ml-auto pl-4 font-medium tabular-nums">
                            {formatValue(row.value)}
                        </span>
                    </div>
                ))}
            </div>
            {total !== null && (
                <div className="mt-1.5 flex items-center border-border/70 border-t pt-1.5">
                    <span className="text-muted-foreground">Total</span>
                    <span className="ml-auto font-semibold tabular-nums">{formatValue(total)}</span>
                </div>
            )}
        </div>
    )
}
