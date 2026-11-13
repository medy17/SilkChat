import { describe, expect, it } from "vitest"

import { parseOpenRouterBenchmarks } from "@/convex/lib/openrouter_benchmarks"
import { buildBenchmarkCards } from "@/lib/model-benchmarks"

const FETCHED_AT = Date.parse("2026-11-13T00:00:00Z")

const feed = (data: unknown[]) => ({ data, meta: { as_of: "2026-11-11T12:00:00Z" } })

describe("parseOpenRouterBenchmarks", () => {
    it("merges every source's rows for a model under its permaslug", () => {
        const benchmarks = parseOpenRouterBenchmarks(
            feed([
                {
                    source: "artificial-analysis",
                    model_permaslug: "acme/orbit-2-20260101",
                    intelligence_index: 61.2,
                    coding_index: null,
                    agentic_index: 48
                },
                {
                    source: "openrouter",
                    model_permaslug: "acme/orbit-2-20260101",
                    benchmark_type: "gpqa_diamond",
                    accuracy: 0.9
                },
                {
                    source: "openrouter",
                    model_permaslug: "acme/orbit-2-20260101",
                    benchmark_type: "search_browsecomp",
                    accuracy: 0.4
                },
                {
                    source: "design-arena",
                    model_permaslug: "acme/orbit-2-20260101",
                    arena: "models",
                    category: "image",
                    elo: 1500
                }
            ]),
            FETCHED_AT
        )

        expect(benchmarks.get("acme/orbit-2-20260101")).toEqual({
            intelligenceIndex: 61.2,
            agenticIndex: 48,
            gpqaDiamond: 0.9,
            asOf: Date.parse("2026-11-11T12:00:00Z")
        })
    })

    it("keeps the best score when a model has a row per reasoning setting", () => {
        const row = (elo: number) => ({
            source: "design-arena",
            model_permaslug: "acme/orbit-2",
            arena: "models",
            category: "codecategories",
            elo
        })

        const benchmarks = parseOpenRouterBenchmarks(feed([row(1350), row(1383)]), FETCHED_AT)

        expect(benchmarks.get("acme/orbit-2")?.codeElo).toBe(1383)
    })

    it("rejects a payload without rows so the previous scores are kept", () => {
        expect(() => parseOpenRouterBenchmarks({ error: "rate limited" }, FETCHED_AT)).toThrow()
    })
})

describe("buildBenchmarkCards", () => {
    it("leads with the index and lists the benchmark under it", () => {
        const [card] = buildBenchmarkCards({
            intelligenceIndex: 61.2,
            gpqaDiamond: 0.904,
            asOf: FETCHED_AT
        })

        expect(card).toEqual({
            key: "intelligence",
            title: "Intelligence",
            value: 61.2,
            displayValue: "61.2%",
            subtitle: "Artificial Analysis",
            breakdownLabel: "GPQA Diamond",
            breakdownValue: "90.4%"
        })
    })

    it("leads with the benchmark when the model has no index", () => {
        const cards = buildBenchmarkCards({
            codeElo: 1383.4,
            tauBenchAirline: 0.8,
            asOf: FETCHED_AT
        })

        expect(cards).toEqual([
            {
                key: "coding",
                title: "Coding",
                value: 1383.4,
                displayValue: "1383",
                subtitle: "Design Arena Code Elo"
            },
            {
                key: "agentic",
                title: "Agentic",
                value: 80,
                displayValue: "80.0%",
                subtitle: "τ²-Bench Airline"
            }
        ])
    })

    it("has no cards for a model the feed doesn't cover", () => {
        expect(buildBenchmarkCards(null)).toEqual([])
    })
})
