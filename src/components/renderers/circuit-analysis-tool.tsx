import { Activity, CircleAlert, Loader2 } from "lucide-react"
import { memo } from "react"

type CircuitAnalysisInvocation = {
    state: string
    input?: unknown
    output?: unknown
    errorText?: string
}

type ComplexQuantity = {
    real?: number
    imaginary?: number
    magnitude?: number
    phaseDeg?: number
    unit?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const formatNumber = (value: number) => {
    if (value === 0) return "0"
    const absolute = Math.abs(value)
    if (absolute >= 1e4 || absolute < 1e-3) return value.toExponential(4)
    return value.toPrecision(5).replace(/\.?0+$/, "")
}

const formatComplex = (value: unknown) => {
    if (!isRecord(value) || typeof value.magnitude !== "number") return "—"
    const quantity = value as ComplexQuantity
    const magnitude = formatNumber(quantity.magnitude ?? 0)
    const phase = formatNumber(quantity.phaseDeg ?? 0)
    return `${magnitude}${quantity.unit ? ` ${quantity.unit}` : ""} ∠ ${phase}°`
}

const ResultTable = ({ title, rows }: { title: string; rows: Array<[string, string]> }) => (
    <div>
        <h4 className="mb-2 font-medium text-sm">{title}</h4>
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
            <table className="w-full min-w-72 text-sm">
                <tbody>
                    {rows.map(([label, value]) => (
                        <tr key={label} className="border-border border-b last:border-0">
                            <th className="px-3 py-2 text-left font-medium">{label}</th>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                                {value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
)

const CircuitAnalysisResult = ({ output }: { output: Record<string, unknown> }) => {
    const nodes = isRecord(output.nodes) ? output.nodes : null
    const branches = isRecord(output.branches) ? output.branches : null
    const equivalent = isRecord(output.equivalent) ? output.equivalent : null
    const transfer = isRecord(output.transferFunction) ? output.transferFunction : null

    return (
        <figure
            className="not-prose my-5 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card text-card-foreground shadow-sm"
            data-circuit-analysis=""
        >
            <figcaption className="flex items-center gap-2.5 border-border border-b px-4 py-3">
                <Activity className="size-4 text-primary" />
                <div>
                    <h3 className="font-medium text-sm">Circuit analysis</h3>
                    <p className="text-muted-foreground text-xs">
                        {String(output.analysisType ?? "Completed")}
                    </p>
                </div>
            </figcaption>
            <div className="grid gap-4 p-4 md:grid-cols-2">
                {nodes && (
                    <ResultTable
                        title="Node voltages"
                        rows={Object.entries(nodes).map(([id, value]) => [
                            id,
                            formatComplex(value)
                        ])}
                    />
                )}
                {branches && (
                    <>
                        <ResultTable
                            title="Branch currents"
                            rows={Object.entries(branches).map(([id, value]) => [
                                id,
                                formatComplex(isRecord(value) ? value.current : null)
                            ])}
                        />
                        <ResultTable
                            title="Element power"
                            rows={Object.entries(branches).map(([id, value]) => [
                                id,
                                formatComplex(isRecord(value) ? value.power : null)
                            ])}
                        />
                    </>
                )}
                {equivalent && (
                    <ResultTable
                        title={`${String(output.equivalentType ?? "Equivalent")} at ${String(equivalent.port ?? "port")}`}
                        rows={[
                            ["Voltage", formatComplex(equivalent.theveninVoltage)],
                            ["Current", formatComplex(equivalent.nortonCurrent)],
                            [
                                "Resistance",
                                isRecord(equivalent.resistance) &&
                                typeof equivalent.resistance.value === "number"
                                    ? `${formatNumber(equivalent.resistance.value)} ${String(equivalent.resistance.unit ?? "ohm")}`
                                    : "—"
                            ]
                        ]}
                    />
                )}
                {transfer && (
                    <div className="md:col-span-2">
                        <ResultTable
                            title="Transfer function"
                            rows={[
                                ["H(s)", String(transfer.expression ?? "—")],
                                [
                                    "Poles",
                                    Array.isArray(transfer.poles)
                                        ? String(transfer.poles.length)
                                        : "0"
                                ],
                                [
                                    "Zeros",
                                    Array.isArray(transfer.zeros)
                                        ? String(transfer.zeros.length)
                                        : "0"
                                ]
                            ]}
                        />
                    </div>
                )}
                {!nodes && !branches && !equivalent && !transfer && (
                    <p className="text-muted-foreground text-sm">
                        Analysis completed. The returned sweep data can be rendered as a native Bode
                        plot.
                    </p>
                )}
            </div>
        </figure>
    )
}

export const CircuitAnalysisToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: CircuitAnalysisInvocation }) => {
        if (
            toolInvocation.state === "input-streaming" ||
            toolInvocation.state === "input-available"
        ) {
            return (
                <div className="not-prose my-5 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin text-primary" /> Analyzing circuit…
                </div>
            )
        }
        if (
            isRecord(toolInvocation.output) &&
            toolInvocation.output.success === true &&
            toolInvocation.output.kind === "circuit_analysis"
        ) {
            return <CircuitAnalysisResult output={toolInvocation.output} />
        }
        const error =
            isRecord(toolInvocation.output) && typeof toolInvocation.output.error === "string"
                ? toolInvocation.output.error
                : toolInvocation.errorText
        return (
            <div className="not-prose my-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                <CircleAlert className="size-4 shrink-0" />
                {error || "The circuit could not be analyzed."}
            </div>
        )
    }
)

CircuitAnalysisToolRenderer.displayName = "CircuitAnalysisToolRenderer"
