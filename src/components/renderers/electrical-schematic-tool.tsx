"use client"

import {
    type ElectricalCircuit,
    type ElectricalComponent,
    electricalCircuitSchema,
    getCircuitFromToolOutput
} from "@/lib/electrical-engineering"
import {
    type RailSchematicLayout,
    type SchematicPoint,
    buildRailSchematicLayout
} from "@/lib/electrical-schematic-layout"
import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs/lib/elk-api"
import { CircleAlert, CircuitBoard, Loader2 } from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"
import {
    NativeVisualizationShell,
    type NativeVisualizationSize
} from "./native-visualization-shell"

type SchematicToolInvocation = {
    state: string
    input?: unknown
    output?: unknown
    errorText?: string
}

const COMPONENT_WIDTH = 112
const COMPONENT_HEIGHT = 64
const NET_SIZE = 12
const PADDING = 32

const getComponentSize = (component: ElectricalComponent) =>
    component.orientation === "vertical" && component.nodes.length === 2
        ? { width: COMPONENT_HEIGHT, height: COMPONENT_WIDTH }
        : { width: COMPONENT_WIDTH, height: COMPONENT_HEIGHT }

type LayoutState = { graph?: ElkNode; error?: string }

const isBudgetExhausted = (output: unknown) =>
    typeof output === "object" &&
    output !== null &&
    "code" in output &&
    output.code === "tool_budget_exhausted"

const getPortPosition = (component: ElectricalComponent, index: number) => {
    const size = getComponentSize(component)
    if (component.orientation === "vertical" && component.nodes.length === 2) {
        return index === 0
            ? { side: "NORTH", x: size.width / 2, y: 0 }
            : { side: "SOUTH", x: size.width / 2, y: size.height }
    }
    if (component.type === "op_amp") {
        return index < 2
            ? { side: "WEST", x: 0, y: index === 0 ? 20 : 44 }
            : { side: "EAST", x: COMPONENT_WIDTH, y: 32 }
    }
    if (component.type.startsWith("bjt_") || component.type.startsWith("mosfet_")) {
        return index === 0
            ? { side: "WEST", x: 0, y: 32 }
            : { side: "EAST", x: COMPONENT_WIDTH, y: index === 1 ? 10 : 54 }
    }
    if (component.type === "transformer") {
        return index < 2
            ? { side: "WEST", x: 0, y: index === 0 ? 16 : 48 }
            : { side: "EAST", x: COMPONENT_WIDTH, y: index === 2 ? 16 : 48 }
    }
    return index === 0 ? { side: "WEST", x: 0, y: 32 } : { side: "EAST", x: COMPONENT_WIDTH, y: 32 }
}

const toElkGraph = (circuit: ElectricalCircuit): ElkNode => {
    const nodeIds = [...new Set(circuit.components.flatMap((component) => component.nodes))].sort()
    const children: ElkNode[] = [
        ...circuit.components.map((component) => ({
            ...getComponentSize(component),
            id: `component:${component.id}`,
            layoutOptions: { "elk.portConstraints": "FIXED_POS" },
            ports: component.nodes.map((_, index): ElkPort => {
                const position = getPortPosition(component, index)
                return {
                    id: `port:${component.id}:${index}`,
                    width: 1,
                    height: 1,
                    x: position.x,
                    y: position.y,
                    layoutOptions: { "elk.port.side": position.side }
                }
            })
        })),
        ...nodeIds.map((node) => ({
            id: `net:${node}`,
            width: NET_SIZE,
            height: NET_SIZE
        }))
    ]

    const edges: ElkExtendedEdge[] = circuit.components.flatMap((component) =>
        component.nodes.map((node, index) => ({
            id: `wire:${component.id}:${index}`,
            sources: [`port:${component.id}:${index}`],
            targets: [`net:${node}`]
        }))
    )

    return {
        id: "electrical-schematic",
        children,
        edges,
        layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": circuit.layout.direction === "down" ? "DOWN" : "RIGHT",
            "elk.edgeRouting": "ORTHOGONAL",
            "elk.spacing.nodeNode": "38",
            "elk.layered.spacing.nodeNodeBetweenLayers": "52",
            "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
            "elk.padding": `[top=${PADDING},left=${PADDING},bottom=${PADDING},right=${PADDING}]`
        }
    }
}

const useSchematicLayout = (circuit: ElectricalCircuit, enabled = true) => {
    const [state, setState] = useState<LayoutState>({})
    useEffect(() => {
        let cancelled = false
        setState({})
        if (!enabled) return
        void Promise.all([
            import("elkjs/lib/elk-api.js"),
            import("elkjs/lib/elk-worker.min.js?worker")
        ])
            .then(async ([{ default: ELK }, { default: ELKWorker }]) => {
                const graph = await new ELK({
                    workerFactory: () => new ELKWorker()
                }).layout(toElkGraph(circuit))
                if (!cancelled) setState({ graph })
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setState({
                        error: error instanceof Error ? error.message : "Schematic layout failed"
                    })
                }
            })
        return () => {
            cancelled = true
        }
    }, [circuit, enabled])

    return state
}

const ResistorSymbol = () => (
    <path d="M 0 32 H 22 L 28 20 L 38 44 L 48 20 L 58 44 L 68 20 L 78 44 L 84 32 H 112" />
)

const CapacitorSymbol = () => (
    <>
        <path d="M 0 32 H 47 M 47 15 V 49 M 65 15 V 49 M 65 32 H 112" />
    </>
)

const InductorSymbol = () => (
    <path d="M 0 32 H 24 C 24 16 40 16 40 32 C 40 16 56 16 56 32 C 56 16 72 16 72 32 C 72 16 88 16 88 32 H 112" />
)

const SourceSymbol = ({
    current = false,
    dependent = false,
    vertical = false,
    positiveAtStart = true
}: {
    current?: boolean
    dependent?: boolean
    vertical?: boolean
    positiveAtStart?: boolean
}) => (
    <>
        {vertical ? (
            <>
                <path d="M 32 0 V 28 M 32 84 V 112" />
                {dependent ? (
                    <path d="M 32 28 L 57 56 L 32 84 L 7 56 Z" />
                ) : (
                    <circle cx="32" cy="56" r="27" />
                )}
                {current ? (
                    <path d="M 32 69 V 43 M 25 50 L 32 43 L 39 50" />
                ) : (
                    <>
                        <path
                            d={
                                positiveAtStart
                                    ? "M 25 45 H 39 M 32 38 V 52"
                                    : "M 25 68 H 39 M 32 61 V 75"
                            }
                            stroke="var(--destructive)"
                        />
                        <path
                            d={positiveAtStart ? "M 25 68 H 39" : "M 25 45 H 39"}
                            stroke="var(--chart-2)"
                        />
                    </>
                )}
            </>
        ) : (
            <>
                <path d="M 0 32 H 28 M 84 32 H 112" />
                {dependent ? (
                    <path d="M 28 32 L 56 7 L 84 32 L 56 57 Z" />
                ) : (
                    <circle cx="56" cy="32" r="27" />
                )}
                {current ? (
                    <path d="M 56 44 V 20 M 49 27 L 56 20 L 63 27" />
                ) : (
                    <>
                        <path
                            d={
                                positiveAtStart
                                    ? "M 45 25 H 55 M 50 20 V 30"
                                    : "M 62 41 H 72 M 67 36 V 46"
                            }
                            stroke="var(--destructive)"
                        />
                        <path
                            d={positiveAtStart ? "M 62 41 H 72" : "M 45 25 H 55"}
                            stroke="var(--chart-2)"
                        />
                    </>
                )}
            </>
        )}
    </>
)

const DiodeSymbol = ({ led = false }: { led?: boolean }) => (
    <>
        <path d="M 0 32 H 34 M 78 32 H 112 M 34 15 L 70 32 L 34 49 Z M 74 15 V 49" />
        {led && (
            <path d="M 66 10 L 82 0 M 76 17 L 92 7 M 77 1 L 82 0 L 81 6 M 87 8 L 92 7 L 91 13" />
        )}
    </>
)

const SwitchSymbol = () => (
    <path d="M 0 32 H 36 M 76 32 H 112 M 36 32 L 75 14 M 36 28 A 4 4 0 1 0 36 36 M 76 28 A 4 4 0 1 0 76 36" />
)

const TransistorSymbol = ({ kind }: { kind: ElectricalComponent["type"] }) => {
    const isMosfet = kind.startsWith("mosfet")
    const pointsOut = kind === "bjt_npn" || kind === "mosfet_n"
    return (
        <>
            <path d="M 0 32 H 40 M 112 10 H 72 V 22 L 58 29 M 112 54 H 72 V 42 L 58 35" />
            {isMosfet ? <path d="M 43 17 V 47 M 53 18 V 46" /> : <path d="M 43 16 V 48" />}
            <path d={pointsOut ? "M 61 38 L 71 42 L 64 48" : "M 70 42 L 61 38 L 64 48"} />
        </>
    )
}

const OpAmpSymbol = () => (
    <>
        <path d="M 22 8 L 22 56 L 88 32 Z M 0 20 H 22 M 0 44 H 22 M 88 32 H 112" />
        <path d="M 28 20 H 38 M 33 15 V 25 M 28 44 H 38" />
    </>
)

const TransformerSymbol = () => (
    <>
        <path d="M 0 16 H 28 M 0 48 H 28 M 84 16 H 112 M 84 48 H 112 M 52 10 V 54 M 60 10 V 54" />
        <path d="M 28 16 C 40 16 40 28 28 28 C 40 28 40 40 28 40 C 40 40 40 48 28 48 M 84 16 C 72 16 72 28 84 28 C 72 28 72 40 84 40 C 72 40 72 48 84 48" />
    </>
)

const ProbeSymbol = () => <path d="M 0 32 H 46 M 46 32 L 66 12 M 61 12 H 72 V 23 M 66 12 L 84 30" />

const ComponentGlyph = ({
    type,
    vertical = false,
    positiveAtStart = true
}: {
    type: ElectricalComponent["type"]
    vertical?: boolean
    positiveAtStart?: boolean
}) => {
    if (type === "resistor") return <ResistorSymbol />
    if (type === "capacitor") return <CapacitorSymbol />
    if (type === "inductor") return <InductorSymbol />
    if (type === "voltage_source") {
        return <SourceSymbol vertical={vertical} positiveAtStart={positiveAtStart} />
    }
    if (type === "current_source") return <SourceSymbol current vertical={vertical} />
    if (type === "dependent_voltage_source") {
        return <SourceSymbol dependent vertical={vertical} positiveAtStart={positiveAtStart} />
    }
    if (type === "dependent_current_source") {
        return <SourceSymbol current dependent vertical={vertical} />
    }
    if (type === "diode") return <DiodeSymbol />
    if (type === "led") return <DiodeSymbol led />
    if (type === "switch") return <SwitchSymbol />
    if (type === "op_amp") return <OpAmpSymbol />
    if (type === "transformer") return <TransformerSymbol />
    if (type === "probe") return <ProbeSymbol />
    return <TransistorSymbol kind={type} />
}

const getNetColor = (nodeId: string, supplyNode?: string) => {
    if (nodeId === "0") return "var(--muted-foreground)"
    if (nodeId === supplyNode) return "var(--chart-1)"
    if (/^(?:v?in|v?out)$/i.test(nodeId)) return "var(--chart-2)"
    let hash = 0
    for (const character of nodeId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
    return `var(--chart-${2 + (hash % 4)})`
}

const getComponentColor = (component: ElectricalComponent) => {
    if (component.type === "voltage_source" || component.type === "current_source") {
        return "var(--chart-1)"
    }
    if (component.type === "probe") return "var(--chart-2)"
    if (
        component.type === "diode" ||
        component.type === "led" ||
        component.type.startsWith("bjt_") ||
        component.type.startsWith("mosfet_")
    ) {
        return "var(--chart-3)"
    }
    if (component.type.startsWith("dependent_")) return "var(--chart-4)"
    return "var(--foreground)"
}

const getComponentValue = (component: ElectricalComponent) =>
    component.value ?? component.source?.magnitude

export const formatElectricalQuantity = (quantity: string) =>
    quantity
        .replace(/([kKMGTmunpµ]?)\s*(?:ohms?|Ω)/gi, (_match, prefix: string) => {
            const normalizedPrefix = prefix === "K" ? "k" : prefix === "u" ? "µ" : prefix
            return `${normalizedPrefix}Ω`
        })
        .replace(/([\d.])\s*u(?=[FAVW]\b)/g, "$1 µ")

const formatNodeLabel = (nodeId: string) => {
    const conventionalLabels: Record<string, string> = {
        vin: "Vin",
        vout: "Vout",
        vcc: "VCC",
        vdd: "VDD",
        vee: "VEE",
        vss: "VSS"
    }
    return conventionalLabels[nodeId.toLowerCase()] ?? nodeId
}

const ComponentDrawing = ({
    component,
    x,
    y,
    width,
    height,
    orientation,
    positiveAtStart = true
}: {
    component: ElectricalComponent
    x: number
    y: number
    width: number
    height: number
    orientation: "horizontal" | "vertical"
    positiveAtStart?: boolean
}) => {
    const vertical = orientation === "vertical" && component.nodes.length === 2
    const source = component.type === "voltage_source" || component.type === "current_source"
    const transform = vertical
        ? source
            ? `translate(${x} ${y})`
            : `translate(${x + width / 2} ${y + height / 2}) rotate(90) translate(${-COMPONENT_WIDTH / 2} ${-COMPONENT_HEIGHT / 2})`
        : `translate(${x} ${y})`
    const value = getComponentValue(component)
    const labelX = vertical ? x + width + 11 : x + width / 2
    const labelY = vertical ? y + height / 2 - (value ? 5 : -4) : y - 8
    const anchor = vertical ? "start" : "middle"

    return (
        <g>
            <title>{component.label ?? `${component.id}${value ? `, ${value}` : ""}`}</title>
            <g
                transform={transform}
                fill="none"
                stroke={getComponentColor(component)}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <ComponentGlyph
                    type={component.type}
                    vertical={vertical && source}
                    positiveAtStart={positiveAtStart}
                />
            </g>
            <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fill={getComponentColor(component)}
                fontSize="12"
                fontWeight="650"
            >
                {component.id}
            </text>
            {value && (
                <text
                    x={labelX}
                    y={vertical ? labelY + 16 : y + height + 15}
                    textAnchor={anchor}
                    fill="var(--muted-foreground)"
                    fontSize="11"
                >
                    {formatElectricalQuantity(value)}
                </text>
            )}
        </g>
    )
}

const Wire = ({ edge, circuit }: { edge: ElkExtendedEdge; circuit: ElectricalCircuit }) => {
    const sections = edge.sections ?? []
    const match = edge.id?.match(/^wire:(.+):(\d+)$/)
    const component = match
        ? circuit.components.find((candidate) => candidate.id === match[1])
        : undefined
    const nodeId = component && match ? component.nodes[Number(match[2])] : undefined
    return (
        <>
            {sections.map((section, index) => {
                const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
                return (
                    <polyline
                        key={`${edge.id}:${index}`}
                        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                        fill="none"
                        stroke={nodeId ? getNetColor(nodeId) : "var(--muted-foreground)"}
                    />
                )
            })}
        </>
    )
}

const RailSchematicSvg = ({
    circuit,
    layout
}: { circuit: ElectricalCircuit; layout: RailSchematicLayout }) => {
    const components = new Map(circuit.components.map((component) => [component.id, component]))
    const terminalEndpoint = (
        placement: RailSchematicLayout["components"][number],
        terminalIndex: number
    ) => {
        const otherIndex = terminalIndex === 0 ? 1 : 0
        const isTop = placement.nodePoints[terminalIndex].y < placement.nodePoints[otherIndex].y
        return {
            x: placement.x + placement.width / 2,
            y: isTop ? placement.y : placement.y + placement.height
        }
    }
    const railComponents = layout.components.map((placement) => ({
        placement,
        component: components.get(placement.componentId)
    }))
    const topPoints = railComponents.flatMap(({ placement, component }) =>
        component
            ? component.nodes.flatMap((nodeId, index) =>
                  nodeId === layout.supplyNode ? [placement.nodePoints[index]] : []
              )
            : []
    )
    const groundPoints = railComponents.flatMap(({ placement, component }) =>
        component
            ? component.nodes.flatMap((nodeId, index) =>
                  nodeId === "0" ? [placement.nodePoints[index]] : []
              )
            : []
    )
    const railBounds = (points: SchematicPoint[]) => ({
        minimum: Math.min(...points.map((point) => point.x)),
        maximum: Math.max(...points.map((point) => point.x), 0)
    })
    const topRail = railBounds(topPoints)
    const groundRail = railBounds(groundPoints)
    const groundPoint = layout.nets.find((net) => net.nodeId === "0")

    return (
        <svg
            role="img"
            aria-label={`${circuit.title} electrical schematic`}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
        >
            <g fill="none" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path
                    d={`M ${topRail.minimum} ${topPoints[0].y} H ${topRail.maximum}`}
                    stroke={getNetColor(layout.supplyNode, layout.supplyNode)}
                />
                <path
                    d={`M ${groundRail.minimum} ${groundPoints[0].y} H ${groundRail.maximum}`}
                    stroke={getNetColor("0", layout.supplyNode)}
                />
                {railComponents.map(({ placement, component }) =>
                    component?.nodes.map((nodeId, index) => {
                        const endpoint = terminalEndpoint(placement, index)
                        const netPoint = placement.nodePoints[index]
                        return (
                            <path
                                key={`${component.id}:${index}`}
                                d={`M ${endpoint.x} ${endpoint.y} L ${netPoint.x} ${netPoint.y}`}
                                stroke={getNetColor(nodeId, layout.supplyNode)}
                            />
                        )
                    })
                )}
            </g>

            {layout.nets.map((net) => {
                if (net.nodeId === "0") return null
                const color = getNetColor(net.nodeId, layout.supplyNode)
                return (
                    <g key={net.nodeId}>
                        <circle cx={net.x} cy={net.y} r={net.rail ? 3.5 : 4.5} fill={color} />
                        {circuit.layout.showNodeLabels && (
                            <text
                                x={net.x + 9}
                                y={net.y - 10}
                                fill={color}
                                fontSize="11"
                                fontWeight={net.rail ? "600" : "500"}
                            >
                                {formatNodeLabel(net.nodeId)}
                            </text>
                        )}
                    </g>
                )
            })}

            {groundPoint && (
                <g
                    transform={`translate(${groundPoint.x - 12} ${groundPoint.y})`}
                    stroke={getNetColor("0", layout.supplyNode)}
                    strokeWidth="2.25"
                >
                    <path d="M 12 0 V 8 M 2 8 H 22 M 6 13 H 18 M 10 18 H 14" />
                </g>
            )}

            {layout.components.map((placement) => {
                const component = components.get(placement.componentId)
                const positiveAtStart =
                    placement.orientation === "vertical"
                        ? placement.nodePoints[0].y < placement.nodePoints[1].y
                        : placement.nodePoints[0].x < placement.nodePoints[1].x
                return component ? (
                    <ComponentDrawing
                        key={component.id}
                        component={component}
                        {...placement}
                        positiveAtStart={positiveAtStart}
                    />
                ) : null
            })}

            {circuit.components
                .filter((component) => component.type === "probe")
                .map((probe) => {
                    const net = layout.nets.find((candidate) => candidate.nodeId === probe.nodes[0])
                    if (!net) return null
                    return (
                        <g key={probe.id} transform={`translate(${net.x + 13} ${net.y + 8})`}>
                            <path
                                d="M 0 0 L 14 14 M 9 14 H 20 V 3"
                                fill="none"
                                stroke="var(--chart-2)"
                                strokeWidth="2"
                            />
                            <text x="25" y="13" fill="var(--chart-2)" fontSize="11">
                                {probe.label ?? probe.id}
                            </text>
                        </g>
                    )
                })}
        </svg>
    )
}

const SchematicSvg = ({ circuit, graph }: { circuit: ElectricalCircuit; graph: ElkNode }) => {
    const childMap = new Map((graph.children ?? []).map((child) => [child.id, child]))
    const width = Math.max(graph.width ?? 0, 320)
    const height = Math.max(graph.height ?? 0, 200)

    return (
        <svg
            role="img"
            aria-label={`${circuit.title} electrical schematic`}
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
        >
            <g fill="none" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                {(graph.edges ?? []).map((edge) => (
                    <Wire key={edge.id} edge={edge as ElkExtendedEdge} circuit={circuit} />
                ))}
            </g>
            {(graph.children ?? [])
                .filter((child) => child.id?.startsWith("net:"))
                .map((child) => {
                    const node = child.id?.slice(4) ?? ""
                    const x = (child.x ?? 0) + (child.width ?? NET_SIZE) / 2
                    const y = (child.y ?? 0) + (child.height ?? NET_SIZE) / 2
                    const color = getNetColor(node)
                    if (node === "0") {
                        return (
                            <g
                                key={child.id}
                                transform={`translate(${x - 12} ${y - 2})`}
                                stroke={color}
                                strokeWidth="2"
                            >
                                <path d="M 12 0 V 7 M 2 7 H 22 M 6 12 H 18 M 10 17 H 14" />
                            </g>
                        )
                    }
                    return (
                        <g key={child.id}>
                            <circle cx={x} cy={y} r="4" fill={color} />
                            {circuit.layout.showNodeLabels && (
                                <text x={x + 8} y={y - 8} fill={color} fontSize="11">
                                    {formatNodeLabel(node)}
                                </text>
                            )}
                        </g>
                    )
                })}
            {circuit.components.map((component) => {
                const child = childMap.get(`component:${component.id}`)
                if (!child) return null
                const x = child.x ?? 0
                const y = child.y ?? 0
                return (
                    <ComponentDrawing
                        key={component.id}
                        component={component}
                        x={x}
                        y={y}
                        width={child.width ?? getComponentSize(component).width}
                        height={child.height ?? getComponentSize(component).height}
                        orientation={component.orientation}
                    />
                )
            })}
        </svg>
    )
}

const SchematicSurface = ({
    circuit,
    expanded,
    size
}: { circuit: ElectricalCircuit; expanded: boolean; size?: NativeVisualizationSize }) => {
    const railLayout = useMemo(() => buildRailSchematicLayout(circuit), [circuit])
    const { graph, error } = useSchematicLayout(circuit, !railLayout)
    const height = expanded ? (size?.height ?? 0) : 420

    if (railLayout) {
        return (
            <div className="overflow-hidden bg-background/30 p-3" style={{ height }}>
                <RailSchematicSvg circuit={circuit} layout={railLayout} />
            </div>
        )
    }

    if (error)
        return (
            <div className="flex h-72 items-center justify-center px-4 text-destructive text-sm">
                {error}
            </div>
        )
    if (!graph)
        return (
            <div className="flex h-72 items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" /> Laying out schematic…
            </div>
        )

    return (
        <div className="overflow-hidden bg-background/30 p-3" style={{ height }}>
            <SchematicSvg circuit={circuit} graph={graph} />
        </div>
    )
}

export const ElectricalSchematicRenderer = memo(({ circuit }: { circuit: ElectricalCircuit }) => (
    <NativeVisualizationShell
        kind="schematic"
        title={circuit.title}
        description={circuit.description}
        icon={<CircuitBoard className="size-4" />}
        dataAttribute="data-electrical-schematic"
        renderVisualization={(expanded, size) => (
            <SchematicSurface circuit={circuit} expanded={expanded} size={size} />
        )}
    />
))

ElectricalSchematicRenderer.displayName = "ElectricalSchematicRenderer"

export const ElectricalSchematicToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: SchematicToolInvocation }) => {
        if (
            toolInvocation.state === "input-streaming" ||
            toolInvocation.state === "input-available"
        ) {
            return (
                <div className="not-prose my-5 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin text-primary" /> Preparing schematic…
                </div>
            )
        }
        const parsedInput = electricalCircuitSchema.safeParse(toolInvocation.input)
        const circuit =
            getCircuitFromToolOutput(toolInvocation.output) ??
            (isBudgetExhausted(toolInvocation.output) && parsedInput.success
                ? parsedInput.data
                : null)
        if (circuit) return <ElectricalSchematicRenderer circuit={circuit} />
        return (
            <div className="not-prose my-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                <CircleAlert className="size-4 shrink-0" />
                {toolInvocation.errorText || "The schematic could not be rendered."}
            </div>
        )
    }
)

ElectricalSchematicToolRenderer.displayName = "ElectricalSchematicToolRenderer"
