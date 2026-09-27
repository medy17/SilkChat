"use client"

import {
    type NativeNetwork,
    getNativeNetworkFingerprint,
    getNativeNetworkFromToolOutput,
    getNativeNetworkInitialPositions,
    nativeNetworkSchema
} from "@/lib/native-network"
import type { Core, ElementDefinition, LayoutOptions, StylesheetJson } from "cytoscape"
import { CircleAlert, Loader2 } from "lucide-react"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import {
    SpotlightChips,
    SpotlightFrame,
    type SpotlightSize,
    useSpotlightFilter
} from "./spotlight-frame"

export const NATIVE_NETWORK_VIEWPORT_HEIGHT = 360

type NetworkToolInvocation = {
    state: string
    input?: unknown
    output?: unknown
    errorText?: string
}

const readThemeColor = (
    styles: CSSStyleDeclaration,
    name: string,
    fallback: string,
    colorContext?: CanvasRenderingContext2D | null
) => {
    const value = styles.getPropertyValue(name).trim()
    if (!value || !colorContext) return value || fallback

    colorContext.clearRect(0, 0, 1, 1)
    colorContext.fillStyle = "rgb(1, 2, 3)"
    colorContext.fillStyle = value
    if (colorContext.fillStyle === "#010203") return fallback

    colorContext.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = colorContext.getImageData(0, 0, 1, 1).data
    return alpha === 255
        ? `rgb(${red}, ${green}, ${blue})`
        : `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`
}

const UNGROUPED_KEY = "default"

/** Node groups in first-seen order; the palette index cycles through the five chart colors. */
export const getNetworkGroups = (network: NativeNetwork) => {
    const groups = new Map<string, { key: string; label: string; paletteIndex: number }>()
    for (const node of network.nodes) {
        const key = node.group ?? UNGROUPED_KEY
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label: node.group ?? "Ungrouped",
                paletteIndex: groups.size % 5
            })
        }
    }
    return [...groups.values()]
}

// Spotlight emphasis: hidden groups drop out, a hovered node keeps its neighbourhood lit,
// and a focused group chip keeps that group and its internal edges lit.
const applyEmphasis = (
    graph: Core,
    hiddenGroups: ReadonlySet<string>,
    focusGroup: string | null,
    hoveredNodeId?: string
) => {
    graph.batch(() => {
        const elements = graph.elements()
        elements.removeClass("spotlight-dimmed spotlight-hidden")
        const nodes = graph.nodes()
        nodes.filter((node) => hiddenGroups.has(node.data("group"))).addClass("spotlight-hidden")

        if (hoveredNodeId) {
            const neighbourhood = graph.getElementById(hoveredNodeId).closedNeighborhood()
            elements.not(neighbourhood).addClass("spotlight-dimmed")
        } else if (focusGroup) {
            const groupNodes = nodes.filter((node) => node.data("group") === focusGroup)
            elements
                .not(groupNodes.union(groupNodes.edgesWith(groupNodes)))
                .addClass("spotlight-dimmed")
        }
    })
}

const NativeNetworkPlot = ({
    network,
    expanded = false,
    size,
    hiddenGroups,
    focusGroup
}: {
    network: NativeNetwork
    expanded?: boolean
    size?: SpotlightSize
    hiddenGroups: ReadonlySet<string>
    focusGroup: string | null
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const graphRef = useRef<Core | undefined>(undefined)
    const emphasisRef = useRef({ hiddenGroups, focusGroup })
    emphasisRef.current = { hiddenGroups, focusGroup }
    const fingerprint = getNativeNetworkFingerprint(network)
    const stableNetworkRef = useRef({ fingerprint, network })
    if (stableNetworkRef.current.fingerprint !== fingerprint) {
        stableNetworkRef.current = { fingerprint, network }
    }
    const stableNetwork = stableNetworkRef.current.network
    const [readyFingerprint, setReadyFingerprint] = useState<string>()
    const [failure, setFailure] = useState<{ fingerprint: string; message: string }>()
    const ready = readyFingerprint === fingerprint
    const error = failure?.fingerprint === fingerprint ? failure.message : undefined

    useEffect(() => {
        if (!containerRef.current) return

        let disposed = false
        let graph: Core | undefined
        let resizeObserver: ResizeObserver | undefined
        let layoutFrame: number | undefined
        let themeFrame: number | undefined
        let themeObserver: MutationObserver | undefined

        const mountGraph = async () => {
            try {
                const { default: cytoscape } = await import("cytoscape")
                if (disposed || !containerRef.current) return

                const groups = new Map(
                    getNetworkGroups(stableNetwork).map((group) => [group.key, group.paletteIndex])
                )

                const getPresentation = () => {
                    const theme = getComputedStyle(document.documentElement)
                    const colorCanvas = document.createElement("canvas")
                    colorCanvas.width = 1
                    colorCanvas.height = 1
                    const colorContext = colorCanvas.getContext("2d", {
                        willReadFrequently: true
                    })
                    const foreground = readThemeColor(
                        theme,
                        "--foreground",
                        "#111827",
                        colorContext
                    )
                    const muted = readThemeColor(
                        theme,
                        "--muted-foreground",
                        "#6b7280",
                        colorContext
                    )
                    const border = readThemeColor(theme, "--border", "#d1d5db", colorContext)
                    const surface = readThemeColor(theme, "--card", "#ffffff", colorContext)
                    const labelBackground = readThemeColor(
                        theme,
                        "--popover",
                        "#ffffff",
                        colorContext
                    )
                    const labelForeground = readThemeColor(
                        theme,
                        "--popover-foreground",
                        "#111827",
                        colorContext
                    )
                    const palette = [1, 2, 3, 4, 5].map((index) =>
                        readThemeColor(theme, `--chart-${index}`, "#2563eb", colorContext)
                    )
                    const style: StylesheetJson = [
                        {
                            selector: "node",
                            style: {
                                "background-color": "data(color)",
                                label: "data(label)",
                                color: foreground,
                                "font-size": 12,
                                "text-valign": "bottom",
                                "text-margin-y": 8,
                                "text-wrap": "wrap",
                                "text-max-width": "120px",
                                width: "mapData(value, 0, 100, 24, 54)",
                                height: "mapData(value, 0, 100, 24, 54)",
                                "border-width": 2,
                                "border-color": surface,
                                "transition-property": "opacity",
                                "transition-duration": 150
                            }
                        },
                        {
                            selector: "edge",
                            style: {
                                width: "mapData(weight, 0, 100, 1, 6)",
                                "line-color": muted,
                                "target-arrow-color": muted,
                                "target-arrow-shape": stableNetwork.directed ? "triangle" : "none",
                                "curve-style": "bezier",
                                label: "data(label)",
                                color: labelForeground,
                                "font-size": 11,
                                "text-background-color": labelBackground,
                                "text-background-opacity": 1,
                                "text-background-shape": "roundrectangle",
                                "text-background-padding": "3px",
                                "text-border-color": border,
                                "text-border-opacity": 1,
                                "text-border-width": 1,
                                "line-opacity": 0.7,
                                "transition-property": "opacity",
                                "transition-duration": 150
                            }
                        },
                        {
                            selector: ".spotlight-dimmed",
                            style: { opacity: 0.14 }
                        },
                        {
                            selector: ".spotlight-hidden",
                            style: { display: "none" }
                        },
                        {
                            selector: ":selected",
                            style: {
                                "overlay-color": palette[1],
                                "overlay-opacity": 0.18,
                                "overlay-padding": 6
                            }
                        }
                    ]

                    return { palette, style }
                }

                const presentation = getPresentation()
                const initialPositions = getNativeNetworkInitialPositions(stableNetwork)

                const elements: ElementDefinition[] = [
                    ...stableNetwork.nodes.map((node) => ({
                        data: {
                            id: node.id,
                            label: node.label ?? node.id,
                            value: node.value ?? 1,
                            group: node.group ?? UNGROUPED_KEY,
                            color: presentation.palette[
                                groups.get(node.group ?? UNGROUPED_KEY) ?? 0
                            ]
                        },
                        position: initialPositions.get(node.id)
                    })),
                    ...stableNetwork.edges.map((edge, index) => ({
                        data: {
                            id: edge.id ? `[edge-id:${edge.id}]` : `[edge-index:${index}]`,
                            source: edge.source,
                            target: edge.target,
                            label: edge.label ?? "",
                            weight: edge.weight ?? 1
                        }
                    }))
                ]
                graph = cytoscape({
                    container: containerRef.current,
                    elements,
                    style: presentation.style,
                    layout: {
                        name: "preset",
                        fit: false,
                        animate: false
                    },
                    minZoom: 0.25,
                    maxZoom: 3,
                    wheelSensitivity: 0.2
                })

                graphRef.current = graph
                const emphasize = (hoveredNodeId?: string) => {
                    if (disposed || !graph) return
                    const emphasis = emphasisRef.current
                    applyEmphasis(graph, emphasis.hiddenGroups, emphasis.focusGroup, hoveredNodeId)
                }
                graph.on("mouseover", "node", (event) => emphasize(event.target.id()))
                graph.on("mouseout", "node", () => emphasize())
                emphasize()

                const finishLayout = () => {
                    if (disposed || !graph) return
                    graph.resize()
                    graph.fit(undefined, 32)
                    setReadyFingerprint(fingerprint)
                }
                const layoutOptions: LayoutOptions = {
                    name: stableNetwork.layout,
                    directed: stableNetwork.directed,
                    fit: false,
                    animate: false,
                    stop: finishLayout,
                    ...(stableNetwork.layout === "cose"
                        ? {
                              randomize: false,
                              refresh: 0
                          }
                        : {})
                }
                graph.layout(layoutOptions).run()

                resizeObserver =
                    typeof ResizeObserver === "undefined"
                        ? undefined
                        : new ResizeObserver(() => {
                              graph?.resize()
                          })
                resizeObserver?.observe(containerRef.current)
                layoutFrame = requestAnimationFrame(() => {
                    graph?.resize()
                    graph?.fit(undefined, 32)
                })

                const refreshTheme = () => {
                    if (themeFrame !== undefined) return
                    themeFrame = requestAnimationFrame(() => {
                        themeFrame = undefined
                        if (disposed || !graph) return

                        const nextPresentation = getPresentation()
                        for (const node of stableNetwork.nodes) {
                            graph
                                .getElementById(node.id)
                                .data(
                                    "color",
                                    nextPresentation.palette[
                                        groups.get(node.group ?? UNGROUPED_KEY) ?? 0
                                    ]
                                )
                        }
                        graph.style(nextPresentation.style)
                    })
                }
                themeObserver = new MutationObserver(refreshTheme)
                themeObserver.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ["class", "data-theme", "style"]
                })
            } catch (cause) {
                if (!disposed) {
                    setFailure({
                        fingerprint,
                        message:
                            cause instanceof Error
                                ? cause.message
                                : "The network could not be rendered."
                    })
                }
            }
        }

        void mountGraph()

        return () => {
            disposed = true
            if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame)
            if (themeFrame !== undefined) cancelAnimationFrame(themeFrame)
            themeObserver?.disconnect()
            resizeObserver?.disconnect()
            graph?.destroy()
            graphRef.current = undefined
        }
    }, [fingerprint, stableNetwork])

    useEffect(() => {
        if (graphRef.current && ready) applyEmphasis(graphRef.current, hiddenGroups, focusGroup)
    }, [hiddenGroups, focusGroup, ready])

    if (error) {
        return <div className="p-4 text-destructive text-sm">{error}</div>
    }

    return (
        <div className="relative w-full">
            <div
                ref={containerRef}
                role="img"
                aria-label={`Interactive network: ${network.title}`}
                aria-busy={!ready}
                className={`w-full ${ready ? "visible" : "invisible"}`}
                style={
                    expanded && size
                        ? {
                              width: size.width,
                              height: size.height,
                              minWidth: size.width,
                              minHeight: size.height
                          }
                        : {
                              height: NATIVE_NETWORK_VIEWPORT_HEIGHT,
                              minHeight: NATIVE_NETWORK_VIEWPORT_HEIGHT
                          }
                }
            />
            {!ready && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Arranging network…
                </div>
            )}
        </div>
    )
}

export const NativeNetworkRenderer = memo(({ network }: { network: NativeNetwork }) => {
    const groups = useMemo(() => getNetworkGroups(network), [network])
    const { hiddenKeys, focusKey, toggle, setFocusKey } = useSpotlightFilter(groups.length)

    return (
        <SpotlightFrame
            kind="network"
            title={network.title}
            description={network.description}
            dataAttribute="data-native-network"
            toolbar={
                groups.length > 1 && (
                    <SpotlightChips
                        chips={groups.map((group) => ({
                            key: group.key,
                            label: group.label,
                            color: `var(--chart-${group.paletteIndex + 1})`
                        }))}
                        hiddenKeys={hiddenKeys}
                        onToggle={toggle}
                        onFocusChange={setFocusKey}
                    />
                )
            }
        >
            {(expanded, size) => (
                <div className={expanded ? undefined : "pt-2"}>
                    <NativeNetworkPlot
                        network={network}
                        expanded={expanded}
                        size={size}
                        hiddenGroups={hiddenKeys}
                        focusGroup={focusKey}
                    />
                </div>
            )}
        </SpotlightFrame>
    )
})

NativeNetworkRenderer.displayName = "NativeNetworkRenderer"

export const NativeNetworkToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: NetworkToolInvocation }) => {
        if (
            toolInvocation.state === "input-streaming" ||
            toolInvocation.state === "input-available"
        ) {
            return (
                <div className="not-prose my-5 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Preparing network…
                </div>
            )
        }

        const parsedInput = nativeNetworkSchema.safeParse(toolInvocation.input)
        const network =
            getNativeNetworkFromToolOutput(toolInvocation.output) ??
            (parsedInput.success ? parsedInput.data : null)

        if (network) return <NativeNetworkRenderer network={network} />

        return (
            <div className="not-prose my-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                <CircleAlert className="size-4 shrink-0" />
                {toolInvocation.errorText || "The network could not be rendered."}
            </div>
        )
    }
)

NativeNetworkToolRenderer.displayName = "NativeNetworkToolRenderer"
