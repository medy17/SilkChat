import { NATIVE_CHART_TOOL_NAME, nativeChartSchema } from "@/lib/native-chart"
import { NATIVE_NETWORK_TOOL_NAME, nativeNetworkSchema } from "@/lib/native-network"
import { type Tool, tool } from "ai"
import { z } from "zod"
import { internal } from "../../_generated/api"
import type { ToolAdapter } from "../toolkit"

export const MATH_EXECUTION_TOOL_NAME = "execute_math"
export const MATH_PYTHON_DEPENDENCIES = [
    "sympy",
    "numpy",
    "scipy",
    "pandas",
    "matplotlib",
    "networkx",
    "statsmodels",
    "pint"
] as const

const NATIVE_VISUALIZATION_TOOL_NAMES = new Set([NATIVE_CHART_TOOL_NAME, NATIVE_NETWORK_TOOL_NAME])

export const withStrictNativeVisualizationTools = <T extends Partial<Record<string, Tool>>>(
    tools: T
): T =>
    Object.fromEntries(
        Object.entries(tools).map(([name, definition]) => [
            name,
            definition && NATIVE_VISUALIZATION_TOOL_NAMES.has(name)
                ? ({ ...definition, strict: true } as Tool)
                : definition
        ])
    ) as T

export const getNativeChartTool = ({
    enabled,
    strict = false
}: {
    enabled: boolean
    strict?: boolean
}) => {
    if (!enabled) return {}

    return {
        [NATIVE_CHART_TOOL_NAME]: tool({
            ...(strict ? { strict: true } : {}),
            description: [
                "Render a native, interactive chart directly in the conversation.",
                "This renderer is part of Math Kit, the user-facing name for the mathematical_instruments ability.",
                "Use this instead of Canvas, Mermaid, HTML, React, ASCII art, or image files whenever a line, bar, area, or scatter chart would help answer the user.",
                "For sampled mathematical functions and continuous numeric axes, set xScale to linear and provide enough ordered samples for a smooth curve.",
                "Use concise titles and human-readable series labels. Keep data to the smallest useful set of points.",
                "Every call must include complete, non-empty series and data arrays. Never send chart metadata first and defer either array to a later call.",
                "All series values must be numeric or null. Scatter charts require numeric x-axis values.",
                "Do not call this tool when prose or a small Markdown table communicates the result more clearly."
            ].join("\n"),
            inputSchema: nativeChartSchema,
            execute: async (chart) => ({
                success: true as const,
                kind: "native_chart" as const,
                chart
            })
        })
    }
}

export const getNativeNetworkTool = ({
    enabled,
    strict = false
}: {
    enabled: boolean
    strict?: boolean
}) => {
    if (!enabled) return {}

    return {
        [NATIVE_NETWORK_TOOL_NAME]: tool({
            ...(strict ? { strict: true } : {}),
            description: [
                "Render an interactive node-and-edge network directly in the conversation.",
                "This renderer is part of Math Kit, the user-facing name for the mathematical_instruments ability.",
                "Use for graph theory, dependency maps, relationship networks, paths, trees, and topology where spatial structure matters.",
                "Prefer concise node labels and stable simple ids. Every edge source and target must reference a supplied node.",
                "Use breadthfirst for trees or directed layers, circle for cycles, grid for regular structures, and cose for general networks.",
                "Do not use Mermaid, Canvas, HTML, React, or an image for a network this tool can express."
            ].join("\n"),
            inputSchema: nativeNetworkSchema,
            execute: async (network) => ({
                success: true as const,
                kind: "native_network" as const,
                network
            })
        })
    }
}

const mathExecutionInputSchema = z.object({
    purpose: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe("A short user-facing active phrase describing the calculation."),
    code: z
        .string()
        .min(1)
        .max(100_000)
        .describe("Python 3.13 code. Print the useful result or write supported artifacts."),
    timeoutMs: z.number().int().min(1_000).max(30_000).optional().default(20_000)
})

export const getMathExecutionTool = ({
    enabled,
    execute
}: {
    enabled: boolean
    execute: (input: z.infer<typeof mathExecutionInputSchema>) => Promise<unknown>
}) => {
    if (!enabled) return {}

    return {
        [MATH_EXECUTION_TOOL_NAME]: tool({
            description: [
                "Execute a mathematical or statistical calculation in an isolated Python 3.13 sandbox.",
                "This executor belongs to Math Kit, the user-facing name for the mathematical_instruments ability, and is available independently of the separate general-purpose execute_code tool and Code Execution toggle.",
                `The environment installs these libraries automatically: ${MATH_PYTHON_DEPENDENCIES.join(", ")}.`,
                "Use this to verify non-trivial arithmetic, symbolic algebra, numerical methods, data analysis, statistics, units, or graph algorithms.",
                "Print concise results. For a user-facing chart or network, compute here when needed and then call render_chart or render_network with the resulting data.",
                "Do not use execute_code for the same calculation, and do not generate chart images when a native chart can represent the result."
            ].join("\n"),
            inputSchema: mathExecutionInputSchema,
            execute: async (input) => await execute(mathExecutionInputSchema.parse(input))
        })
    }
}

export const NativeChartAdapter: ToolAdapter = async (params) => {
    const enabled =
        params.enabledTools.includes("mathematical_instruments") &&
        params.toolAvailability.mathematical_instruments.enabled
    if (!enabled) return {}

    const executeMath = getMathExecutionTool({
        enabled: params.toolAvailability.code_execution.enabled,
        execute: async ({ code, timeoutMs }) =>
            await params.ctx.runAction(internal.lib.tools.code_execution_node.executeCode, {
                userId: params.userSettings.userId,
                language: "python",
                code,
                dependencies: [...MATH_PYTHON_DEPENDENCIES],
                sandboxMode: "ephemeral",
                timeoutMs
            })
    })

    return {
        ...getNativeChartTool({ enabled: true }),
        ...getNativeNetworkTool({ enabled: true }),
        ...executeMath
    }
}
