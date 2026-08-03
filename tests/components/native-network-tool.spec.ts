// @vitest-environment jsdom

import {
    NATIVE_NETWORK_VIEWPORT_HEIGHT,
    NativeNetworkRenderer
} from "@/components/renderers/native-network-tool"
import { nativeNetworkSchema } from "@/lib/native-network"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

const { cytoscapeMock, graphStyleMock, nodeDataMock } = vi.hoisted(() => ({
    graphStyleMock: vi.fn(),
    nodeDataMock: vi.fn(),
    cytoscapeMock: vi.fn((_options: unknown) => {
        return {
            destroy: vi.fn(),
            fit: vi.fn(),
            resize: vi.fn(),
            style: graphStyleMock,
            getElementById: vi.fn(() => ({ data: nodeDataMock }))
        }
    })
}))

vi.mock("cytoscape", () => ({
    default: cytoscapeMock
}))

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => {
        let color = ""
        return {
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            get fillStyle() {
                return color
            },
            set fillStyle(value: string) {
                color = value
            },
            getImageData: () => ({
                data: color.includes("0.99")
                    ? new Uint8ClampedArray([250, 250, 250, 255])
                    : new Uint8ClampedArray([20, 20, 20, 255])
            })
        }
    }
})

Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
    }
})

Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    value: vi.fn()
})

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
        width: 1000,
        height: 700,
        top: 0,
        right: 1000,
        bottom: 700,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
    })
})

describe("NativeNetworkRenderer", () => {
    it("keeps a drawable viewport for the graph engine", async () => {
        document.documentElement.style.setProperty("--foreground", "oklch(0 0 0)")
        document.documentElement.style.setProperty("--muted-foreground", "oklch(0.5 0 0)")
        document.documentElement.style.setProperty("--border", "oklch(0.9 0 0)")
        document.documentElement.style.setProperty("--popover", "oklch(0.99 0 0)")
        document.documentElement.style.setProperty("--popover-foreground", "oklch(0 0 0)")
        document.documentElement.style.setProperty("--chart-1", "oklch(0.6 0.2 120)")
        const network = nativeNetworkSchema.parse({
            title: "Example graph",
            nodes: [{ id: "a" }, { id: "b" }],
            edges: [{ source: "a", target: "b" }]
        })

        const { container } = render(React.createElement(NativeNetworkRenderer, { network }))
        const viewport = screen.getByRole("img", { name: "Interactive network: Example graph" })

        expect(viewport.style.height).toBe(`${NATIVE_NETWORK_VIEWPORT_HEIGHT}px`)
        expect(viewport.style.minHeight).toBe(`${NATIVE_NETWORK_VIEWPORT_HEIGHT}px`)
        expect(container.querySelector("[data-native-network]")?.contains(viewport)).toBe(true)

        await vi.waitFor(() => expect(cytoscapeMock).toHaveBeenCalled())
        const options = cytoscapeMock.mock.calls[0]?.[0] as {
            elements: Array<{ data: { id: string } }>
            style: Array<{ selector: string; style: Record<string, unknown> }>
        }
        expect(options.elements.map(({ data }) => data.id)).toEqual(["a", "b", "[edge-index:0]"])
        const edgeStyle = options.style.find(({ selector }) => selector === "edge")?.style
        expect(edgeStyle?.color).toBe("rgb(20, 20, 20)")
        expect(edgeStyle?.["text-background-color"]).toBe("rgb(250, 250, 250)")
        expect(edgeStyle?.["text-background-opacity"]).toBe(1)
    })

    it("namespaces explicit edge ids away from node ids", async () => {
        const network = nativeNetworkSchema.parse({
            title: "Colliding domain ids",
            nodes: [{ id: "shared" }, { id: "target" }],
            edges: [{ id: "shared", source: "shared", target: "target" }]
        })

        render(React.createElement(NativeNetworkRenderer, { network }))

        await vi.waitFor(() => expect(cytoscapeMock).toHaveBeenCalled())
        const options = cytoscapeMock.mock.lastCall?.[0] as {
            elements: Array<{ data: { id: string } }>
        }
        expect(options.elements.map(({ data }) => data.id)).toEqual([
            "shared",
            "target",
            "[edge-id:shared]"
        ])
    })

    it("refreshes graph colors when the root theme changes", async () => {
        const network = nativeNetworkSchema.parse({
            title: "Theme-aware graph",
            nodes: [{ id: "a" }],
            edges: []
        })

        render(React.createElement(NativeNetworkRenderer, { network }))
        await vi.waitFor(() => expect(cytoscapeMock).toHaveBeenCalled())

        document.documentElement.style.setProperty("--foreground", "oklch(0.9 0 0)")

        await vi.waitFor(() => expect(graphStyleMock).toHaveBeenCalled())
        expect(nodeDataMock).toHaveBeenCalledWith("color", expect.any(String))
    })

    it("opens a fitted focus view for the network", async () => {
        const network = nativeNetworkSchema.parse({
            title: "Expanded network",
            nodes: [{ id: "a" }, { id: "b" }],
            edges: [{ source: "a", target: "b" }]
        })
        const callsBeforeRender = cytoscapeMock.mock.calls.length

        render(React.createElement(NativeNetworkRenderer, { network }))
        await vi.waitFor(() => expect(cytoscapeMock.mock.calls.length).toBe(callsBeforeRender + 1))
        const expandButton = screen.getByRole("button", { name: "Expand network" })
        expect(expandButton.classList.contains("hidden")).toBe(true)
        expect(expandButton.classList.contains("md:flex")).toBe(true)
        fireEvent.click(expandButton)

        await vi.waitFor(() => expect(cytoscapeMock.mock.calls.length).toBe(callsBeforeRender + 2))
        const dialog = screen.getByRole("dialog")
        expect(dialog.classList.contains("bg-card")).toBe(true)
        expect(dialog.style.width).toBe("92vw")
        expect(dialog.style.height).toBe("85vh")
        expect(dialog.style.maxWidth).toBe("80rem")
        expect(dialog.style.maxHeight).toBe("56rem")
        expect(screen.getByRole("button", { name: "Close expanded network" })).toBeTruthy()
        const viewport = screen.getByRole("img", {
            name: "Interactive network: Expanded network"
        })
        expect(viewport.style.width).toBe("1000px")
        expect(viewport.style.height).toBe("700px")
    })
})
