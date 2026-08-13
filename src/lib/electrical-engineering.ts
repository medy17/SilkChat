import { z } from "zod"

export const ANALYZE_CIRCUIT_TOOL_NAME = "analyze_circuit"
export const RENDER_SCHEMATIC_TOOL_NAME = "render_schematic"
export const RENDER_ELECTRICAL_PLOT_TOOL_NAME = "render_electrical_plot"

const electricalIdSchema = z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[A-Za-z0-9_.:+-]+$/, "Use a short alphanumeric electrical identifier")

const quantitySchema = z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe("A quantity with units, for example 10 kohm, 100 nF, 5 V, or 2.4 GHz.")

export const electricalComponentTypeSchema = z.enum([
    "resistor",
    "capacitor",
    "inductor",
    "voltage_source",
    "current_source",
    "dependent_voltage_source",
    "dependent_current_source",
    "diode",
    "led",
    "switch",
    "op_amp",
    "bjt_npn",
    "bjt_pnp",
    "mosfet_n",
    "mosfet_p",
    "transformer",
    "probe"
])

export type ElectricalComponentType = z.infer<typeof electricalComponentTypeSchema>

export const ELECTRICAL_COMPONENT_SUPPORT: Record<
    ElectricalComponentType,
    "linear_analysis" | "render_only"
> = {
    resistor: "linear_analysis",
    capacitor: "linear_analysis",
    inductor: "linear_analysis",
    voltage_source: "linear_analysis",
    current_source: "linear_analysis",
    dependent_voltage_source: "render_only",
    dependent_current_source: "render_only",
    diode: "render_only",
    led: "render_only",
    switch: "render_only",
    op_amp: "render_only",
    bjt_npn: "render_only",
    bjt_pnp: "render_only",
    mosfet_n: "render_only",
    mosfet_p: "render_only",
    transformer: "render_only",
    probe: "render_only"
}

const sourceSchema = z.object({
    kind: z.enum(["dc", "ac"]),
    magnitude: quantitySchema,
    phase: quantitySchema.optional()
})

export const electricalComponentSchema = z.object({
    id: electricalIdSchema,
    type: electricalComponentTypeSchema,
    nodes: z.array(electricalIdSchema).min(1).max(4),
    value: quantitySchema.optional(),
    source: sourceSchema.optional(),
    label: z.string().trim().min(1).max(80).optional(),
    orientation: z.enum(["horizontal", "vertical"]).optional().default("horizontal")
})

export const electricalCircuitSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(1)
            .max(120)
            .describe("Top-level title for the complete circuit schematic."),
        description: z.string().trim().max(280).optional(),
        components: z.array(electricalComponentSchema).min(1).max(60),
        ports: z
            .array(
                z.object({
                    id: electricalIdSchema,
                    positive: electricalIdSchema,
                    negative: electricalIdSchema
                })
            )
            .max(12)
            .optional()
            .default([])
            .describe(
                "Optional circuit measurement ports. Each array item is one terminal definition with id, positive node id, and negative node id."
            ),
        layout: z
            .object({
                direction: z.enum(["right", "down"]).optional().default("right"),
                showNodeLabels: z.boolean().optional().default(true)
            })
            .optional()
            .default({ direction: "right", showNodeLabels: true })
    })
    .superRefine((circuit, ctx) => {
        const componentIds = new Set<string>()
        const nodeIds = new Set<string>(["0"])

        circuit.components.forEach((component, index) => {
            if (componentIds.has(component.id)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["components", index, "id"],
                    message: "Component ids must be unique"
                })
            }
            componentIds.add(component.id)
            component.nodes.forEach((node) => nodeIds.add(node))

            const requiresTwoNodes = ![
                "op_amp",
                "bjt_npn",
                "bjt_pnp",
                "mosfet_n",
                "mosfet_p",
                "transformer",
                "probe"
            ].includes(component.type)
            if (requiresTwoNodes && component.nodes.length !== 2) {
                ctx.addIssue({
                    code: "custom",
                    path: ["components", index, "nodes"],
                    message: `${component.type} requires exactly two nodes`
                })
            }
            const requiredNodeCount =
                component.type === "op_amp" ||
                component.type.startsWith("bjt_") ||
                component.type.startsWith("mosfet_")
                    ? 3
                    : component.type === "transformer"
                      ? 4
                      : component.type === "probe"
                        ? 1
                        : undefined
            if (requiredNodeCount && component.nodes.length !== requiredNodeCount) {
                ctx.addIssue({
                    code: "custom",
                    path: ["components", index, "nodes"],
                    message: `${component.type} requires exactly ${requiredNodeCount} nodes`
                })
            }
            if (
                ["resistor", "capacitor", "inductor"].includes(component.type) &&
                !component.value
            ) {
                ctx.addIssue({
                    code: "custom",
                    path: ["components", index, "value"],
                    message: `${component.type} requires a value with units`
                })
            }
            if (
                ["voltage_source", "current_source"].includes(component.type) &&
                !component.source
            ) {
                ctx.addIssue({
                    code: "custom",
                    path: ["components", index, "source"],
                    message: `${component.type} requires a source definition`
                })
            }
        })

        const portIds = new Set<string>()
        circuit.ports.forEach((port, index) => {
            if (portIds.has(port.id)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["ports", index, "id"],
                    message: "Port ids must be unique"
                })
            }
            portIds.add(port.id)
            if (!nodeIds.has(port.positive)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["ports", index, "positive"],
                    message: "Port must reference an existing node"
                })
            }
            if (!nodeIds.has(port.negative)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["ports", index, "negative"],
                    message: "Port must reference an existing node"
                })
            }
        })
    })

export type ElectricalCircuit = z.infer<typeof electricalCircuitSchema>
export type ElectricalComponent = z.infer<typeof electricalComponentSchema>

export const circuitAnalysisSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("dc_operating_point") }),
    z.object({ type: z.literal("ac_point"), frequency: quantitySchema }),
    z.object({
        type: z.literal("ac_sweep"),
        start: quantitySchema,
        stop: quantitySchema,
        points: z.number().int().min(2).max(500).optional().default(160),
        outputPort: electricalIdSchema.optional()
    }),
    z.object({
        type: z.literal("transfer_function"),
        inputSource: electricalIdSchema,
        outputPort: electricalIdSchema
    }),
    z.object({
        type: z.literal("equivalent"),
        kind: z.enum(["thevenin", "norton"]),
        port: electricalIdSchema
    })
])

export const analyzeCircuitInputSchema = z
    .object({
        purpose: z.string().trim().min(1).max(80),
        circuit: electricalCircuitSchema,
        analysis: circuitAnalysisSchema,
        timeoutMs: z.number().int().min(1_000).max(30_000).optional().default(20_000)
    })
    .superRefine((input, ctx) => {
        const portIds = new Set(input.circuit.ports.map((port) => port.id))
        const componentIds = new Set(input.circuit.components.map((component) => component.id))
        const { analysis } = input
        const referencedPort =
            analysis.type === "equivalent"
                ? analysis.port
                : analysis.type === "transfer_function" || analysis.type === "ac_sweep"
                  ? analysis.outputPort
                  : undefined
        if (referencedPort && !portIds.has(referencedPort)) {
            ctx.addIssue({
                code: "custom",
                path: ["analysis", analysis.type === "equivalent" ? "port" : "outputPort"],
                message: "Analysis must reference a declared circuit port"
            })
        }
        if (analysis.type === "transfer_function" && !componentIds.has(analysis.inputSource)) {
            ctx.addIssue({
                code: "custom",
                path: ["analysis", "inputSource"],
                message: "Transfer-function input must reference a circuit component"
            })
        }
    })

const finiteNumber = z.number().finite()
const plotSeriesSchema = z.object({
    key: electricalIdSchema,
    label: z.string().trim().min(1).max(80),
    unit: z.string().trim().min(1).max(24).optional()
})

const waveformPlotSchema = z.object({
    type: z.literal("waveform"),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(280).optional(),
    xLabel: z.string().trim().max(80).optional().default("Time"),
    yLabel: z.string().trim().max(80).optional().default("Amplitude"),
    series: z.array(plotSeriesSchema).min(1).max(6),
    data: z
        .array(z.object({ x: finiteNumber }).catchall(z.union([finiteNumber, z.null()])))
        .min(2)
        .max(1000)
        .describe(
            'Waveform samples. x and every property named by series.key must be unquoted JSON numbers or null; numeric strings are invalid. Example: {"x":0.5,"vin":1.25}.'
        ),
    timePerDivision: z.string().trim().max(40).optional(),
    voltsPerDivision: z.string().trim().max(40).optional()
})

const bodePlotSchema = z.object({
    type: z.literal("bode"),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(280).optional(),
    traces: z
        .array(
            z.object({
                frequencyHz: finiteNumber.positive(),
                magnitudeDb: finiteNumber,
                phaseDeg: finiteNumber
            })
        )
        .min(2)
        .max(1000)
})

const phasorPlotSchema = z.object({
    type: z.literal("phasor"),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(280).optional(),
    unit: z.string().trim().min(1).max(24).optional(),
    phasors: z
        .array(
            z.object({
                label: z.string().trim().min(1).max(80),
                magnitude: finiteNumber.nonnegative(),
                phaseDeg: finiteNumber
            })
        )
        .min(1)
        .max(12)
})

export const electricalPlotSchema = z
    .discriminatedUnion("type", [waveformPlotSchema, bodePlotSchema, phasorPlotSchema])
    .superRefine((plot, ctx) => {
        if (plot.type === "waveform") {
            const keys = new Set<string>()
            plot.series.forEach((series, index) => {
                if (keys.has(series.key)) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["series", index, "key"],
                        message: "Waveform series keys must be unique"
                    })
                }
                keys.add(series.key)
            })
            plot.data.forEach((row, rowIndex) => {
                plot.series.forEach((series) => {
                    if (typeof row[series.key] !== "number" && row[series.key] !== null) {
                        ctx.addIssue({
                            code: "custom",
                            path: ["data", rowIndex, series.key],
                            message: "Every waveform row must contain each numeric series"
                        })
                    }
                })
            })
        }
        if (plot.type === "bode") {
            plot.traces.forEach((trace, index) => {
                if (index > 0 && trace.frequencyHz <= plot.traces[index - 1].frequencyHz) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["traces", index, "frequencyHz"],
                        message: "Bode frequencies must be strictly increasing"
                    })
                }
            })
        }
    })

export type ElectricalPlot = z.infer<typeof electricalPlotSchema>

export const schematicToolOutputSchema = z.object({
    success: z.literal(true),
    kind: z.literal("electrical_schematic"),
    circuit: electricalCircuitSchema
})

export const electricalPlotToolOutputSchema = z.object({
    success: z.literal(true),
    kind: z.literal("electrical_plot"),
    plot: electricalPlotSchema
})

export const getCircuitFromToolOutput = (output: unknown): ElectricalCircuit | null => {
    const parsed = schematicToolOutputSchema.safeParse(output)
    return parsed.success ? parsed.data.circuit : null
}

export const getElectricalPlotFromToolOutput = (output: unknown): ElectricalPlot | null => {
    const parsed = electricalPlotToolOutputSchema.safeParse(output)
    return parsed.success ? parsed.data.plot : null
}
