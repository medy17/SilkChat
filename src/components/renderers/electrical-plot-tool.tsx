"use client"

import {
    type ElectricalPlot,
    electricalPlotSchema,
    getElectricalPlotFromToolOutput
} from "@/lib/electrical-engineering"
import { Activity, CircleAlert, Loader2 } from "lucide-react"
import { memo } from "react"
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts"
import {
    NativeVisualizationShell,
    type NativeVisualizationSize
} from "./native-visualization-shell"

type ElectricalPlotInvocation = {
    state: string
    input?: unknown
    output?: unknown
    errorText?: string
}

const isBudgetExhausted = (output: unknown) =>
    typeof output === "object" &&
    output !== null &&
    "code" in output &&
    output.code === "tool_budget_exhausted"

const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--foreground)"
]

const axisProps = {
    tickLine: false,
    axisLine: false,
    tick: { fill: "var(--muted-foreground)", fontSize: 11 }
} as const

const tooltipStyle = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--popover-foreground)",
    fontSize: 12
}

const WaveformView = ({ plot }: { plot: Extract<ElectricalPlot, { type: "waveform" }> }) => (
    <div className="flex h-full min-h-0 flex-col" data-waveform-plot>
        <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={plot.data} margin={{ top: 12, right: 18, bottom: 34, left: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                    <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.7} />
                    <XAxis
                        {...axisProps}
                        dataKey="x"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        label={{
                            value: plot.xLabel,
                            position: "insideBottom",
                            offset: -18,
                            fill: "var(--muted-foreground)",
                            fontSize: 11
                        }}
                    />
                    <YAxis
                        {...axisProps}
                        width={56}
                        label={{
                            value: plot.yLabel,
                            angle: -90,
                            position: "insideLeft",
                            fill: "var(--muted-foreground)",
                            fontSize: 11
                        }}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(value) => `t = ${Number(value).toPrecision(5)}`}
                    />
                    {plot.series.map((series, index) => (
                        <Line
                            key={series.key}
                            type="linear"
                            dataKey={series.key}
                            name={`${series.label}${series.unit ? ` (${series.unit})` : ""}`}
                            stroke={COLORS[index % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
        <div
            aria-label="Waveform legend"
            className="flex min-h-7 shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pt-1 text-[11px] text-muted-foreground"
        >
            {plot.series.map((series, index) => (
                <span key={series.key} className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className="w-3 border-t-2"
                        style={{ borderColor: COLORS[index % COLORS.length] }}
                    />
                    {series.label}
                    {series.unit ? ` (${series.unit})` : ""}
                </span>
            ))}
        </div>
    </div>
)

const BodeView = ({ plot }: { plot: Extract<ElectricalPlot, { type: "bode" }> }) => (
    <div className="grid h-full min-h-0 grid-rows-2 gap-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={plot.traces} margin={{ top: 8, right: 16, bottom: 4, left: 6 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                    {...axisProps}
                    dataKey="frequencyHz"
                    type="number"
                    scale="log"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) => Number(value).toExponential(0)}
                />
                <YAxis {...axisProps} width={54} unit=" dB" />
                <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(value) => `${Number(value).toPrecision(5)} Hz`}
                />
                <Line
                    type="monotone"
                    dataKey="magnitudeDb"
                    name="Magnitude"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                />
            </LineChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={plot.traces} margin={{ top: 4, right: 16, bottom: 18, left: 6 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                    {...axisProps}
                    dataKey="frequencyHz"
                    type="number"
                    scale="log"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) => Number(value).toExponential(0)}
                    label={{
                        value: "Frequency (Hz)",
                        position: "insideBottom",
                        offset: -12,
                        fill: "var(--muted-foreground)",
                        fontSize: 11
                    }}
                />
                <YAxis {...axisProps} width={54} unit="°" />
                <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(value) => `${Number(value).toPrecision(5)} Hz`}
                />
                <Line
                    type="monotone"
                    dataKey="phaseDeg"
                    name="Phase"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                />
            </LineChart>
        </ResponsiveContainer>
    </div>
)

const PhasorView = ({ plot }: { plot: Extract<ElectricalPlot, { type: "phasor" }> }) => {
    const maximum = Math.max(...plot.phasors.map((phasor) => phasor.magnitude), 1)
    const center = 180
    const radius = 140
    return (
        <svg
            role="img"
            aria-label={`${plot.title} phasor diagram`}
            viewBox="0 0 360 360"
            className="h-full w-full"
        >
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" />
            <path
                d={`M 20 ${center} H 340 M ${center} 20 V 340`}
                stroke="var(--border)"
                strokeWidth="1"
            />
            {[0.25, 0.5, 0.75].map((scale) => (
                <circle
                    key={scale}
                    cx={center}
                    cy={center}
                    r={radius * scale}
                    fill="none"
                    stroke="var(--border)"
                    strokeDasharray="3 5"
                />
            ))}
            {plot.phasors.map((phasor, index) => {
                const angle = (-phasor.phaseDeg * Math.PI) / 180
                const length = (phasor.magnitude / maximum) * radius
                const x = center + Math.cos(angle) * length
                const y = center + Math.sin(angle) * length
                const color = COLORS[index % COLORS.length]
                return (
                    <g key={`${phasor.label}:${index}`}>
                        <defs>
                            <marker
                                id={`phasor-arrow-${index}`}
                                markerWidth="8"
                                markerHeight="8"
                                refX="7"
                                refY="3"
                                orient="auto"
                            >
                                <path d="M0,0 L0,6 L8,3 z" fill={color} />
                            </marker>
                        </defs>
                        <line
                            x1={center}
                            y1={center}
                            x2={x}
                            y2={y}
                            stroke={color}
                            strokeWidth="2.5"
                            markerEnd={`url(#phasor-arrow-${index})`}
                        />
                        <text
                            x={x + (x >= center ? 8 : -8)}
                            y={y - 8}
                            textAnchor={x >= center ? "start" : "end"}
                            fill={color}
                            fontSize="12"
                            fontWeight="600"
                        >
                            {phasor.label}
                        </text>
                        <text
                            x={x + (x >= center ? 8 : -8)}
                            y={y + 8}
                            textAnchor={x >= center ? "start" : "end"}
                            fill="var(--muted-foreground)"
                            fontSize="10"
                        >
                            {phasor.magnitude.toPrecision(4)}
                            {plot.unit ? ` ${plot.unit}` : ""} ∠ {phasor.phaseDeg.toFixed(1)}°
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}

const ElectricalPlotSurface = ({
    plot,
    expanded,
    size
}: { plot: ElectricalPlot; expanded: boolean; size?: NativeVisualizationSize }) => {
    const height = expanded ? (size?.height ?? 0) : plot.type === "bode" ? 460 : 360
    return (
        <div className="overflow-hidden bg-background/30 px-2 py-3 sm:px-4" style={{ height }}>
            {plot.type === "waveform" ? (
                <WaveformView plot={plot} />
            ) : plot.type === "bode" ? (
                <BodeView plot={plot} />
            ) : (
                <PhasorView plot={plot} />
            )}
        </div>
    )
}

export const ElectricalPlotRenderer = memo(({ plot }: { plot: ElectricalPlot }) => (
    <NativeVisualizationShell
        kind="electrical plot"
        title={plot.title}
        description={plot.description}
        icon={<Activity className="size-4" />}
        dataAttribute="data-electrical-plot"
        renderVisualization={(expanded, size) => (
            <ElectricalPlotSurface plot={plot} expanded={expanded} size={size} />
        )}
    />
))

ElectricalPlotRenderer.displayName = "ElectricalPlotRenderer"

export const ElectricalPlotToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: ElectricalPlotInvocation }) => {
        if (
            toolInvocation.state === "input-streaming" ||
            toolInvocation.state === "input-available"
        ) {
            return (
                <div className="not-prose my-5 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin text-primary" /> Preparing electrical
                    plot…
                </div>
            )
        }
        const parsedInput = electricalPlotSchema.safeParse(toolInvocation.input)
        const plot =
            getElectricalPlotFromToolOutput(toolInvocation.output) ??
            (isBudgetExhausted(toolInvocation.output) && parsedInput.success
                ? parsedInput.data
                : null)
        if (plot) return <ElectricalPlotRenderer plot={plot} />
        return (
            <div className="not-prose my-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                <CircleAlert className="size-4 shrink-0" />
                {toolInvocation.errorText || "The electrical plot could not be rendered."}
            </div>
        )
    }
)

ElectricalPlotToolRenderer.displayName = "ElectricalPlotToolRenderer"
