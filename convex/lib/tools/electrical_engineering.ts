import {
    ANALYZE_CIRCUIT_TOOL_NAME,
    RENDER_ELECTRICAL_PLOT_TOOL_NAME,
    RENDER_SCHEMATIC_TOOL_NAME,
    analyzeCircuitInputSchema,
    electricalCircuitSchema,
    electricalPlotSchema
} from "@/lib/electrical-engineering"
import { type Tool, tool } from "ai"
import { internal } from "../../_generated/api"
import { buildElectricalSolverProgram } from "../electrical/solver_program"
import type { ToolAdapter } from "../toolkit"

export const ELECTRICAL_PYTHON_DEPENDENCIES = ["sympy", "numpy", "scipy", "pint"] as const

const ELECTRICAL_TOOL_NAMES = new Set([
    ANALYZE_CIRCUIT_TOOL_NAME,
    RENDER_SCHEMATIC_TOOL_NAME,
    RENDER_ELECTRICAL_PLOT_TOOL_NAME
])

export const withStrictElectricalTools = <T extends Partial<Record<string, Tool>>>(tools: T): T =>
    Object.fromEntries(
        Object.entries(tools).map(([name, definition]) => [
            name,
            definition && ELECTRICAL_TOOL_NAMES.has(name)
                ? ({ ...definition, strict: true } as Tool)
                : definition
        ])
    ) as T

export const getElectricalRenderingTools = ({ enabled }: { enabled: boolean }) => {
    if (!enabled) return {}

    return {
        [RENDER_SCHEMATIC_TOOL_NAME]: tool({
            description: [
                "Render a native electrical circuit schematic directly in the conversation.",
                "Provide components and electrical node connections; the renderer performs layout.",
                "Use this instead of Mermaid, ASCII art, Canvas, generated images, HTML, or Circuitikz.",
                "Rendering a component does not imply that analyze_circuit can solve it.",
                "Use node 0 for ground and concise component ids such as R1, C1, and V1.",
                "Follow the input schema exactly, preserving required fields, nesting, and JSON types."
            ].join("\n"),
            inputSchema: electricalCircuitSchema,
            execute: async (circuit) => ({
                success: true as const,
                kind: "electrical_schematic" as const,
                circuit
            })
        }),
        [RENDER_ELECTRICAL_PLOT_TOOL_NAME]: tool({
            description: [
                "Render a native electrical waveform, phasor diagram, or Bode plot.",
                "Supply complete numeric data in the invocation. This tool does not evaluate formulas or simulate circuits.",
                "Follow the input schema exactly. For waveform data, x and every series value MUST be an unquoted JSON number or null, never a numeric string.",
                'Correct waveform row: {"x": 0.5, "vin": 1.25}. Wrong: {"x": 0.5, "vin": "1.25"}.',
                "Before calling, verify that every data row contains every declared series key with the required JSON type.",
                "Use this instead of a generic chart when electrical conventions such as decibels, phase, phasor arrows, or oscilloscope presentation matter."
            ].join("\n"),
            inputSchema: electricalPlotSchema,
            execute: async (plot) => ({
                success: true as const,
                kind: "electrical_plot" as const,
                plot
            })
        })
    }
}

const parseSolverOutput = (execution: unknown) => {
    if (!execution || typeof execution !== "object") return execution
    const record = execution as Record<string, unknown>
    const billing = record.__toolBilling
    if (record.success !== true || typeof record.stdout !== "string") return execution

    const line = record.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)
    if (!line) {
        return {
            success: false,
            kind: "circuit_analysis_error",
            code: "empty_solver_output",
            error: "The circuit solver returned no result.",
            ...(billing ? { __toolBilling: billing } : {})
        }
    }

    try {
        const parsed = JSON.parse(line) as Record<string, unknown>
        return { ...parsed, ...(billing ? { __toolBilling: billing } : {}) }
    } catch {
        return {
            success: false,
            kind: "circuit_analysis_error",
            code: "invalid_solver_output",
            error: "The circuit solver returned an unreadable result.",
            ...(billing ? { __toolBilling: billing } : {})
        }
    }
}

export const ElectricalEngineeringAdapter: ToolAdapter = async (params) => {
    const enabled =
        params.enabledTools.includes("electrical_engineering") &&
        params.toolAvailability.electrical_engineering.enabled
    if (!enabled) return {}

    const renderers = getElectricalRenderingTools({ enabled: true })
    const analysisAvailable = params.toolAvailability.code_execution.enabled

    return {
        ...renderers,
        ...(analysisAvailable
            ? {
                  [ANALYZE_CIRCUIT_TOOL_NAME]: tool({
                      description: [
                          "Solve a bounded linear electrical circuit using a deterministic unit-aware solver.",
                          "Supports DC operating points, AC points and sweeps, transfer functions, and Thevenin/Norton equivalents for RLC circuits with independent voltage and current sources.",
                          "Results use current flowing from the first declared component node to the second as the positive convention.",
                          "Do not use this for diodes, transistors, non-ideal op-amps, nonlinear devices, or arbitrary SPICE models.",
                          "When a visual helps, call render_schematic or render_electrical_plot with the relevant complete data."
                      ].join("\n"),
                      inputSchema: analyzeCircuitInputSchema,
                      execute: async (rawInput) => {
                          const input = analyzeCircuitInputSchema.parse(rawInput)
                          const execution = await params.ctx.runAction(
                              internal.lib.tools.code_execution_node.executeCode,
                              {
                                  userId: params.userSettings.userId,
                                  language: "python",
                                  code: buildElectricalSolverProgram(input),
                                  dependencies: [...ELECTRICAL_PYTHON_DEPENDENCIES],
                                  sandboxMode: "ephemeral",
                                  timeoutMs: input.timeoutMs
                              }
                          )
                          return parseSolverOutput(execution)
                      }
                  })
              }
            : {})
    }
}
