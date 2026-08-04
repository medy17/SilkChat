import {
    getNativeNetworkFromToolOutput,
    getNativeNetworkInitialPositions,
    nativeNetworkSchema
} from "@/lib/native-network"
import { describe, expect, it, vi } from "vitest"
import {
    MATH_PYTHON_DEPENDENCIES,
    getMathExecutionTool,
    getNativeNetworkTool
} from "../../convex/lib/tools/native_chart"

const validNetwork = {
    title: "Dependency graph",
    directed: true,
    layout: "breadthfirst" as const,
    nodes: [
        { id: "app", label: "App" },
        { id: "api", label: "API" }
    ],
    edges: [{ source: "app", target: "api", label: "calls" }]
}

describe("native network contract", () => {
    it("accepts a bounded graph and supplies defaults", () => {
        const parsed = nativeNetworkSchema.parse(validNetwork)

        expect(parsed.directed).toBe(true)
        expect(parsed.nodes).toHaveLength(2)
    })

    it("rejects duplicate nodes and dangling edges", () => {
        const parsed = nativeNetworkSchema.safeParse({
            ...validNetwork,
            nodes: [{ id: "app" }, { id: "app" }],
            edges: [{ source: "app", target: "missing" }]
        })

        expect(parsed.success).toBe(false)
    })

    it("seeds force layouts deterministically regardless of node arrival order", () => {
        const forwards = nativeNetworkSchema.parse(validNetwork)
        const backwards = nativeNetworkSchema.parse({
            ...validNetwork,
            nodes: [...validNetwork.nodes].reverse()
        })

        expect(getNativeNetworkInitialPositions(forwards)).toEqual(
            getNativeNetworkInitialPositions(backwards)
        )
    })

    it("returns a replayable native network result", async () => {
        const tools = getNativeNetworkTool({ enabled: true })
        const output = await tools.render_network?.execute?.(validNetwork, {} as never)

        expect(getNativeNetworkFromToolOutput(output)).toMatchObject({
            title: "Dependency graph",
            directed: true
        })
        expect(getNativeNetworkTool({ enabled: false })).toEqual({})
    })

    it("executes math through a fixed scientific Python environment", async () => {
        const execute = vi.fn(async () => ({ success: true, stdout: "4" }))
        const tools = getMathExecutionTool({ enabled: true, execute })
        const output = await tools.execute_math?.execute?.(
            { purpose: "Checking the integral", code: "print(2 + 2)" },
            {} as never
        )

        expect(output).toEqual({ success: true, stdout: "4" })
        expect(execute).toHaveBeenCalledWith({
            purpose: "Checking the integral",
            code: "print(2 + 2)",
            timeoutMs: 20_000
        })
        expect(MATH_PYTHON_DEPENDENCIES).toEqual([
            "sympy",
            "numpy",
            "scipy",
            "pandas",
            "matplotlib",
            "networkx",
            "statsmodels",
            "pint"
        ])
    })
})
