import type { ElectricalCircuit, ElectricalComponent } from "./electrical-engineering"

export type SchematicPoint = { x: number; y: number }

export type SchematicComponentPlacement = {
    componentId: string
    x: number
    y: number
    width: number
    height: number
    orientation: "horizontal" | "vertical"
    nodePoints: [SchematicPoint, SchematicPoint]
}

export type SchematicNetPlacement = SchematicPoint & { nodeId: string; rail: boolean }

export type RailSchematicLayout = {
    kind: "rail"
    width: number
    height: number
    supplyNode: string
    groundNode: "0"
    sourceId: string
    components: SchematicComponentPlacement[]
    nets: SchematicNetPlacement[]
}

type PathStep = { component: ElectricalComponent; from: string; to: string }

const SOURCE_X = 80
const FIRST_BRANCH_X = 460
const BRANCH_SPACING = 190
const TOP_Y = 52
const MIN_STAGE_HEIGHT = 150
const VERTICAL_COMPONENT_WIDTH = 64
const VERTICAL_COMPONENT_HEIGHT = 112
const RIGHT_PADDING = 120
const BOTTOM_PADDING = 58
const MAX_PATHS = 8

const isGroundReferencedSource = (component: ElectricalComponent) =>
    (component.type === "voltage_source" || component.type === "current_source") &&
    component.nodes.length === 2 &&
    component.nodes.includes("0")

const enumeratePaths = ({
    components,
    start,
    target
}: {
    components: ElectricalComponent[]
    start: string
    target: string
}) => {
    const adjacency = new Map<string, Array<{ component: ElectricalComponent; next: string }>>()
    for (const component of components) {
        if (component.nodes.length !== 2) continue
        const [left, right] = component.nodes
        adjacency.set(left, [...(adjacency.get(left) ?? []), { component, next: right }])
        adjacency.set(right, [...(adjacency.get(right) ?? []), { component, next: left }])
    }

    for (const edges of adjacency.values()) {
        edges.sort((left, right) => left.component.id.localeCompare(right.component.id))
    }

    const paths: PathStep[][] = []
    const visit = (
        node: string,
        steps: PathStep[],
        usedComponents: Set<string>,
        visitedNodes: Set<string>
    ) => {
        if (paths.length >= MAX_PATHS) return
        if (node === target) {
            if (steps.length > 0) paths.push(steps)
            return
        }
        if (steps.length >= components.length) return

        for (const edge of adjacency.get(node) ?? []) {
            if (usedComponents.has(edge.component.id) || visitedNodes.has(edge.next)) continue
            visit(
                edge.next,
                [...steps, { component: edge.component, from: node, to: edge.next }],
                new Set([...usedComponents, edge.component.id]),
                new Set([...visitedNodes, edge.next])
            )
        }
    }

    visit(start, [], new Set(), new Set([start]))
    return paths
}

export const buildRailSchematicLayout = (
    circuit: ElectricalCircuit
): RailSchematicLayout | null => {
    const source = circuit.components.find(isGroundReferencedSource)
    if (!source) return null

    const supplyNode = source.nodes.find((node) => node !== "0")
    if (!supplyNode) return null

    const drawableComponents = circuit.components.filter(
        (component) => component.id !== source.id && component.type !== "probe"
    )
    if (
        drawableComponents.length === 0 ||
        drawableComponents.some(
            (component) =>
                component.nodes.length !== 2 ||
                component.type === "voltage_source" ||
                component.type === "current_source"
        )
    ) {
        return null
    }

    const paths = enumeratePaths({
        components: drawableComponents,
        start: supplyNode,
        target: "0"
    })
    if (paths.length === 0) return null

    const componentUse = new Map<string, number>()
    for (const path of paths) {
        for (const step of path) {
            componentUse.set(step.component.id, (componentUse.get(step.component.id) ?? 0) + 1)
        }
    }
    if (
        componentUse.size !== drawableComponents.length ||
        [...componentUse.values()].some((count) => count !== 1)
    ) {
        return null
    }

    const maximumStages = Math.max(...paths.map((path) => path.length))
    const stageHeight = Math.max(MIN_STAGE_HEIGHT, 126 + 20 * (maximumStages - 1))
    const bottomY = TOP_Y + maximumStages * stageHeight
    const branchXs = paths.map((_, index) => FIRST_BRANCH_X + index * BRANCH_SPACING)
    const componentPlacements: SchematicComponentPlacement[] = []
    const netPointCandidates = new Map<string, SchematicPoint[]>()

    const addNetPoint = (nodeId: string, point: SchematicPoint) => {
        netPointCandidates.set(nodeId, [...(netPointCandidates.get(nodeId) ?? []), point])
    }

    paths.forEach((path, pathIndex) => {
        const x = branchXs[pathIndex]
        const pathStageHeight = (bottomY - TOP_Y) / path.length
        path.forEach((step, stepIndex) => {
            const fromPoint = { x, y: TOP_Y + stepIndex * pathStageHeight }
            const toPoint = { x, y: TOP_Y + (stepIndex + 1) * pathStageHeight }
            addNetPoint(step.from, fromPoint)
            addNetPoint(step.to, toPoint)

            const topNodeIsFirst = step.component.nodes[0] === step.from
            componentPlacements.push({
                componentId: step.component.id,
                x: x - VERTICAL_COMPONENT_WIDTH / 2,
                y: fromPoint.y + (toPoint.y - fromPoint.y - VERTICAL_COMPONENT_HEIGHT) / 2,
                width: VERTICAL_COMPONENT_WIDTH,
                height: VERTICAL_COMPONENT_HEIGHT,
                orientation: "vertical",
                nodePoints: topNodeIsFirst ? [fromPoint, toPoint] : [toPoint, fromPoint]
            })
        })
    })

    const sourceNodeZeroIsFirst = source.nodes[0] === "0"
    const sourcePlacement: SchematicComponentPlacement = {
        componentId: source.id,
        x: SOURCE_X - VERTICAL_COMPONENT_WIDTH / 2,
        y: TOP_Y + (bottomY - TOP_Y - VERTICAL_COMPONENT_HEIGHT) / 2,
        width: VERTICAL_COMPONENT_WIDTH,
        height: VERTICAL_COMPONENT_HEIGHT,
        orientation: "vertical",
        nodePoints: sourceNodeZeroIsFirst
            ? [
                  { x: SOURCE_X, y: bottomY },
                  { x: SOURCE_X, y: TOP_Y }
              ]
            : [
                  { x: SOURCE_X, y: TOP_Y },
                  { x: SOURCE_X, y: bottomY }
              ]
    }

    addNetPoint(supplyNode, { x: SOURCE_X, y: TOP_Y })
    addNetPoint("0", { x: SOURCE_X, y: bottomY })

    const nets = [...netPointCandidates.entries()].map(([nodeId, points]) => {
        const isRail = nodeId === supplyNode || nodeId === "0"
        const y = isRail
            ? nodeId === supplyNode
                ? TOP_Y
                : bottomY
            : points.reduce((sum, point) => sum + point.y, 0) / points.length
        const x = isRail
            ? (Math.min(...points.map((point) => point.x)) +
                  Math.max(...points.map((point) => point.x))) /
              2
            : points.reduce((sum, point) => sum + point.x, 0) / points.length
        return { nodeId, x, y, rail: isRail }
    })

    const width = Math.max(...branchXs, SOURCE_X) + RIGHT_PADDING
    const height = bottomY + BOTTOM_PADDING

    return {
        kind: "rail",
        width,
        height,
        supplyNode,
        groundNode: "0",
        sourceId: source.id,
        components: [sourcePlacement, ...componentPlacements],
        nets
    }
}
