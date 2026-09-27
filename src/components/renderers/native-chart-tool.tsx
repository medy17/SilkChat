import {
    type NativeChart,
    getNativeChartFromToolOutput,
    nativeChartSchema
} from "@/lib/native-chart"
import { cn } from "@/lib/utils"
import { CircleAlert, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { memo, useState } from "react"
import { ChartDataTable } from "./chart-data-table"
import {
    ChartPlot,
    type ChartPlotStyle,
    type PlotTooltipProps,
    formatValue,
    readTooltip,
    seriesSwatchColor,
    useThemeRadiusPx
} from "./chart-plot"
import { SpotlightChips, SpotlightFrame, useSpotlightFilter } from "./spotlight-frame"

type ChartToolInvocation = {
    state: string
    input?: unknown
    output?: unknown
    errorText?: string
}

const CHART_BODY_CLASS = "px-3 pt-3 pb-4"
const INLINE_BODY_HEIGHT = "h-[280px]"

type ChartView = "chart" | "table"

function SpotlightTooltip({ props, chart }: { props: PlotTooltipProps; chart: NativeChart }) {
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

export const NativeChartRenderer = memo(({ chart }: { chart: NativeChart }) => {
    const { hiddenKeys, focusKey, toggle, setFocusKey } = useSpotlightFilter(chart.series.length)
    const barRadius = useThemeRadiusPx("md")
    const [view, setView] = useState<ChartView>("chart")

    const plotStyle: ChartPlotStyle = {
        grid: "solid",
        yAxis: "left",
        lineWidth: 2.5,
        lineDots: "none",
        endDot: true,
        lineShade: true,
        areaFill: "gradient",
        barRadius,
        barMaxSize: 36,
        barGradient: true,
        animate: true,
        cursor: chart.type === "bar" ? "band" : "line",
        tooltip: (props) => <SpotlightTooltip props={props} chart={chart} />
    }

    const plot = (
        <ChartPlot
            chart={chart}
            plotStyle={plotStyle}
            hiddenKeys={hiddenKeys}
            focusKey={focusKey}
        />
    )

    return (
        <SpotlightFrame
            kind="chart"
            title={chart.title}
            description={chart.description}
            dataAttribute="data-native-chart"
            actions={
                <Tabs value={view} onValueChange={(value) => setView(value as ChartView)}>
                    <TabsList className="h-7 p-0.5">
                        <TabsTrigger value="chart" className="h-6 px-2 text-xs shadow-none">
                            Chart
                        </TabsTrigger>
                        <TabsTrigger value="table" className="h-6 px-2 text-xs shadow-none">
                            Table
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            }
            toolbar={
                // Chips double as filters, so a single series never needs them; a model that asks
                // for no legend gets none.
                chart.series.length > 1 &&
                chart.showLegend && (
                    <SpotlightChips
                        chips={chart.series.map((series) => ({
                            key: series.key,
                            label: series.label,
                            color: seriesSwatchColor(chart, series.key)
                        }))}
                        hiddenKeys={hiddenKeys}
                        onToggle={toggle}
                        onFocusChange={setFocusKey}
                    />
                )
            }
        >
            {(expanded, size) => {
                const sizing =
                    expanded && size ? { style: size } : { className: INLINE_BODY_HEIGHT }
                // The table takes the plot's exact footprint so switching views never
                // resizes the card.
                return view === "table" ? (
                    <div {...sizing} className={cn("pt-3", sizing.className)}>
                        <div className="h-full border-border border-t">
                            <ChartDataTable chart={chart} hiddenKeys={hiddenKeys} />
                        </div>
                    </div>
                ) : (
                    <div {...sizing} className={cn(CHART_BODY_CLASS, sizing.className)}>
                        {plot}
                    </div>
                )
            }}
        </SpotlightFrame>
    )
})

NativeChartRenderer.displayName = "NativeChartRenderer"

export const NativeChartToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: ChartToolInvocation }) => {
        if (
            toolInvocation.state === "input-streaming" ||
            toolInvocation.state === "input-available"
        ) {
            return (
                <div className="not-prose my-5 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Preparing chart…
                </div>
            )
        }

        const parsedInput = nativeChartSchema.safeParse(toolInvocation.input)
        const chart =
            getNativeChartFromToolOutput(toolInvocation.output) ??
            (parsedInput.success ? parsedInput.data : null)

        if (chart) return <NativeChartRenderer chart={chart} />

        return (
            <div className="not-prose my-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                <CircleAlert className="size-4 shrink-0" />
                The chart could not be rendered.
            </div>
        )
    }
)

NativeChartToolRenderer.displayName = "NativeChartToolRenderer"
