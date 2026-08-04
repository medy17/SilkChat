"use client"

import {
    type NativeNetwork,
    getNativeNetworkFingerprint,
    getNativeNetworkFromToolOutput,
    getNativeNetworkInitialPositions,
    nativeNetworkSchema
} from "@/lib/native-network"
import type { Core, ElementDefinition, LayoutOptions, StylesheetJson } from "cytoscape"
import { CircleAlert, Loader2, Network } from "lucide-react"
import { memo, useEffect, useRef, useState } from "react"
import {
    NativeVisualizationShell,
    type NativeVisualizationSize
} from "./native-visualization-shell"

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

const NativeNetworkPlot = ({
    network,
    expanded = false,
    size
}: {
    network: NativeNetwork
    expanded?: boolean
    size?: NativeVisualizationSize
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
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

                const groups = new Map<string, number>()
                for (const node of stableNetwork.nodes) {
                    const group = node.group ?? "default"
                    if (!groups.has(group)) groups.set(group, groups.size % 5)
                }

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
                                "border-color": border
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
                                "text-border-width": 1
                            }
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
                            color: presentation.palette[groups.get(node.group ?? "default") ?? 0]
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
                                        groups.get(node.group ?? "default") ?? 0
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
        }
    }, [fingerprint, stableNetwork])

    if (error) {
        return <div className="p-4 text-destructive text-sm">{error}</div>
    }

    return (
        <div className="relative w-full bg-background">
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

export const NativeNetworkRenderer = memo(({ network }: { network: NativeNetwork }) => (
    <NativeVisualizationShell
        kind="network"
        title={network.title}
        description={network.description}
        icon={<Network className="size-4" />}
        dataAttribute="data-native-network"
        renderVisualization={(expanded, size) => (
            <NativeNetworkPlot network={network} expanded={expanded} size={size} />
        )}
    />
))

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
