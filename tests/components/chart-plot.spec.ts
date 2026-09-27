// @vitest-environment jsdom

import { formatValue, getFillGradientStops, getNiceTicks } from "@/components/renderers/chart-plot"
import { getNetworkGroups } from "@/components/renderers/native-network-tool"
import { useSpotlightFilter } from "@/components/renderers/spotlight-frame"
import { nativeNetworkSchema } from "@/lib/native-network"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

describe("getNiceTicks", () => {
    it("places numeric axis ticks on round values inside the data domain", () => {
        expect(getNiceTicks([-2 * Math.PI, 2 * Math.PI])).toEqual([-6, -4, -2, 0, 2, 4, 6])
        expect(getNiceTicks([1990, 2024])).toEqual([1990, 1995, 2000, 2005, 2010, 2015, 2020])
        expect(getNiceTicks([0, 1])).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    })

    it("leaves degenerate domains to the axis defaults", () => {
        expect(getNiceTicks([4, 4])).toBeUndefined()
    })

    it("gives up instead of looping when the step is below float precision", () => {
        expect(getNiceTicks([1e16, 1e16 + 2])).toBeUndefined()
    })
})

describe("formatValue", () => {
    it("keeps small values distinct instead of rounding them to zero", () => {
        expect(formatValue(0.0001)).toBe("0.0001")
        expect(formatValue(0.0002)).toBe("0.0002")
        expect(formatValue(1e-7)).not.toBe("0")
        expect(formatValue(0)).toBe("0")
    })
})

describe("useSpotlightFilter", () => {
    it("releases focus when the focused item is hidden", () => {
        const { result } = renderHook(() => useSpotlightFilter(3))

        act(() => result.current.setFocusKey("a"))
        act(() => result.current.toggle("a"))

        expect(result.current.hiddenKeys.has("a")).toBe(true)
        expect(result.current.focusKey).toBeNull()
    })
})

describe("getFillGradientStops", () => {
    it("fades a positive series out at the bottom of its fill", () => {
        expect(getFillGradientStops([1, 3, 2])).toEqual([
            { offset: 0, opacity: 0.42 },
            { offset: 1, opacity: 0 }
        ])
    })

    it("fades signed series to nothing at zero, scaled to the larger side", () => {
        const stops = getFillGradientStops([-4, 0, 2])

        expect(stops.map(({ offset }) => offset)).toEqual([0, 1 / 3, 1])
        expect(stops[1].opacity).toBe(0)
        expect(stops[0].opacity).toBeCloseTo(0.21)
        expect(stops[2].opacity).toBeCloseTo(0.42)
    })

    it("fades a negative series out at the top of its fill", () => {
        expect(getFillGradientStops([-3, -1])).toEqual([
            { offset: 0, opacity: 0 },
            { offset: 1, opacity: 0.42 }
        ])
    })
})

describe("getNetworkGroups", () => {
    it("orders groups by first appearance and cycles the five chart colors", () => {
        const network = nativeNetworkSchema.parse({
            title: "Groups",
            nodes: [
                { id: "a", group: "core" },
                { id: "b" },
                { id: "c", group: "edge" },
                { id: "d", group: "core" },
                ...["g3", "g4", "g5"].map((group) => ({ id: group, group }))
            ],
            edges: []
        })

        expect(
            getNetworkGroups(network).map(({ label, paletteIndex }) => [label, paletteIndex])
        ).toEqual([
            ["core", 0],
            ["Ungrouped", 1],
            ["edge", 2],
            ["g3", 3],
            ["g4", 4],
            ["g5", 0]
        ])
    })
})
