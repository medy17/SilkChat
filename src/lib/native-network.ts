import { z } from "zod"

export const NATIVE_NETWORK_TOOL_NAME = "render_network"

const graphIdSchema = z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(
        /^[A-Za-z0-9_.:-]+$/,
        "Graph ids may contain letters, numbers, dots, colons, dashes, and underscores"
    )

export const nativeNetworkSchema = z
    .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(280).optional(),
        directed: z.boolean().optional().default(false),
        layout: z
            .enum(["cose", "circle", "grid", "breadthfirst", "concentric"])
            .optional()
            .default("cose"),
        nodes: z
            .array(
                z.object({
                    id: graphIdSchema,
                    label: z.string().trim().min(1).max(80).optional(),
                    group: z.string().trim().min(1).max(40).optional(),
                    value: z.number().finite().optional()
                })
            )
            .min(1)
            .max(100),
        edges: z
            .array(
                z.object({
                    id: graphIdSchema.optional(),
                    source: graphIdSchema,
                    target: graphIdSchema,
                    label: z.string().trim().min(1).max(80).optional(),
                    weight: z.number().finite().optional()
                })
            )
            .max(300)
    })
    .superRefine((graph, ctx) => {
        const nodeIds = new Set<string>()
        graph.nodes.forEach((node, index) => {
            if (nodeIds.has(node.id)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["nodes", index, "id"],
                    message: "Node ids must be unique"
                })
            }
            nodeIds.add(node.id)
        })

        const edgeIds = new Set<string>()
        graph.edges.forEach((edge, index) => {
            if (!nodeIds.has(edge.source)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["edges", index, "source"],
                    message: "Edge source must reference an existing node"
                })
            }
            if (!nodeIds.has(edge.target)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["edges", index, "target"],
                    message: "Edge target must reference an existing node"
                })
            }
            if (edge.id) {
                if (edgeIds.has(edge.id)) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["edges", index, "id"],
                        message: "Edge ids must be unique"
                    })
                }
                edgeIds.add(edge.id)
            }
        })
    })

export type NativeNetwork = z.infer<typeof nativeNetworkSchema>

export const getNativeNetworkFingerprint = (network: NativeNetwork) => JSON.stringify(network)

export const getNativeNetworkInitialPositions = (network: NativeNetwork) => {
    const orderedNodeIds = network.nodes.map((node) => node.id).sort()
    const columnCount = Math.ceil(Math.sqrt(orderedNodeIds.length))
    const rowCount = Math.ceil(orderedNodeIds.length / columnCount)
    const spacing = 96

    return new Map(
        orderedNodeIds.map((nodeId, index) => {
            const column = index % columnCount
            const row = Math.floor(index / columnCount)
            return [
                nodeId,
                {
                    x: (column - (columnCount - 1) / 2) * spacing,
                    y: (row - (rowCount - 1) / 2) * spacing
                }
            ] as const
        })
    )
}

export const nativeNetworkToolOutputSchema = z.object({
    success: z.literal(true),
    kind: z.literal("native_network"),
    network: nativeNetworkSchema
})

export const getNativeNetworkFromToolOutput = (output: unknown): NativeNetwork | null => {
    const parsed = nativeNetworkToolOutputSchema.safeParse(output)
    return parsed.success ? parsed.data.network : null
}
