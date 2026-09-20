import {
    getNativeChartFromToolOutput,
    nativeChartSchema,
    type NativeChart
} from "@/lib/native-chart"
import { CircleAlert, Loader2 } from "lucide-react"
import { lazy, memo, Suspense } from "react"

const NativeChartVisualization = lazy(() =>
    import("./native-chart-visualization").then((module) => ({
        default: module.NativeChartRenderer
    }))
)

type ChartToolInvocation = {
    state: string
    input?: unknown
    output?: unknown
    errorText?: string
}

function ChartLoading() {
    return (
        <div
            role="status"
            className="not-prose my-5 flex items-center gap-2 text-muted-foreground text-sm"
        >
            <Loader2 className="size-4 animate-spin text-primary" />
            Preparing chart…
        </div>
    )
}

export const NativeChartRenderer = memo(({ chart }: { chart: NativeChart }) => (
    <Suspense fallback={<ChartLoading />}>
        <NativeChartVisualization chart={chart} />
    </Suspense>
))

NativeChartRenderer.displayName = "NativeChartRenderer"

export const NativeChartToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: ChartToolInvocation }) => {
        if (
            toolInvocation.state === "input-streaming" ||
            toolInvocation.state === "input-available"
        ) {
            return <ChartLoading />
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
