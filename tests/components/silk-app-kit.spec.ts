// @vitest-environment jsdom

import { buildAppChart } from "@/silk-app-runtime/kit/chart"
import { Alert } from "@/silk-app-runtime/kit/surfaces"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { inferDigits } from "@/silk-app-runtime/kit/metrics"
import { describe, expect, it } from "vitest"

describe("buildAppChart", () => {
    it("keys series safely, coerces values, and assigns the right axis", () => {
        const { chart, rightAxisKeys } = buildAppChart({
            data: [
                { hour: "0h", "Blood Glucose": 8.4, parasites: "12" },
                { hour: "4h", "Blood Glucose": null, parasites: "n/a" }
            ],
            x: "hour",
            series: [
                "Blood Glucose",
                { key: "parasites", label: "Parasite density (%)", axis: "right" }
            ]
        })

        expect(chart.series).toEqual([
            { key: "s0", label: "Blood Glucose" },
            { key: "s1", label: "Parasite density (%)" }
        ])
        expect(chart.data).toEqual([
            { hour: "0h", s0: 8.4, s1: 12 },
            { hour: "4h", s0: null, s1: null }
        ])
        expect([...rightAxisKeys]).toEqual(["s1"])
    })

    it("plots at most five series", () => {
        const { chart } = buildAppChart({
            data: [{ x: 1, a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }],
            x: "x",
            series: ["a", "b", "c", "d", "e", "f"]
        })

        expect(chart.series.map((series) => series.label)).toEqual(["a", "b", "c", "d", "e"])
    })

    it("uses a linear x scale for scatter charts with numeric x values", () => {
        const { chart } = buildAppChart({
            type: "scatter",
            data: [
                { t: 0, y: 1 },
                { t: 2.5, y: 3 }
            ],
            x: "t",
            series: ["y"]
        })

        expect(chart.xScale).toBe("linear")
    })
})

describe("inferDigits", () => {
    it("matches the precision a value was written with, ignoring float noise", () => {
        expect(inferDigits(3)).toBe(0)
        expect(inferDigits(1.4)).toBe(1)
        expect(inferDigits(0.01)).toBe(2)
        expect(inferDigits(0.1 + 0.2)).toBe(3)
    })
})

describe("Alert", () => {
    it("accepts an icon passed as a rendered element", () => {
        const html = renderToStaticMarkup(
            createElement(Alert, {
                tone: "critical",
                title: "Pulmonary edema",
                icon: createElement("svg", { "data-icon": "custom" })
            })
        )

        expect(html).toContain('data-icon="custom"')
        expect(html).toContain("Pulmonary edema")
    })
})
