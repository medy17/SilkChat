import type { NativeChart } from "@/lib/native-chart"
import { getPlotRows, seriesSwatchColor } from "./chart-plot"

// The table shows exactly what the model supplied: the shortest round-trip form of each
// number (what String() produces), grouped for reading but never rounded.
const formatCell = (value: unknown) => {
    if (typeof value === "number") {
        const exact = String(value)
        if (/e/i.test(exact)) return exact
        const decimals = exact.split(".")[1]?.length ?? 0
        return value.toLocaleString(undefined, { maximumFractionDigits: Math.min(decimals, 20) })
    }
    return value === null || value === undefined || value === "" ? "–" : String(value)
}

/** The rows behind a chart, laid out like the app's generated markdown tables. */
export function ChartDataTable({
    chart,
    hiddenKeys
}: {
    chart: NativeChart
    hiddenKeys?: ReadonlySet<string>
}) {
    const rows = getPlotRows(chart)
    const series = chart.series.filter((item) => !hiddenKeys?.has(item.key))
    const headCellClass =
        "sticky top-0 bg-[color-mix(in_oklab,var(--secondary)_50%,var(--card))] px-4 py-2.5 font-semibold text-sm"

    return (
        <div className="h-full overflow-auto" data-native-chart-table>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={`${headCellClass} text-left`}>
                            {chart.xLabel ?? chart.xKey}
                        </th>
                        {series.map((item) => (
                            <th key={item.key} className={`${headCellClass} text-right`}>
                                <span className="inline-flex items-center gap-1.5">
                                    <span
                                        aria-hidden
                                        className="size-2 shrink-0 rounded-[var(--radius-sm)]"
                                        style={{ background: seriesSwatchColor(chart, item.key) }}
                                    />
                                    {item.label}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {rows.map((row, index) => (
                        <tr key={index}>
                            <td className="px-4 py-2 text-muted-foreground text-sm">
                                {formatCell(row[chart.xKey])}
                            </td>
                            {series.map((item) => (
                                <td
                                    key={item.key}
                                    className="px-4 py-2 text-right text-sm tabular-nums"
                                >
                                    {formatCell(row[item.key])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
