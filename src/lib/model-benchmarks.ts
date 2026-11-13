import type { ModelBenchmarks } from "@/convex/lib/openrouter_benchmarks"

export type ModelBenchmarkCard = {
    key: "intelligence" | "coding" | "agentic"
    title: string
    value: number
    displayValue: string
    subtitle: string
    breakdownLabel?: string
    breakdownValue?: string
}

// Every score comes through OpenRouter's benchmarks feed, which asks for the original
// source to be named alongside it.
export const BENCHMARK_SOURCE = {
    label: "OpenRouter",
    url: "https://openrouter.ai/rankings"
}

type Score = { label: string; value: number; displayValue: string }

const percent = (label: string, value: number | undefined): Score | undefined =>
    value === undefined ? undefined : { label, value, displayValue: `${value.toFixed(1)}%` }

const accuracy = (label: string, value: number | undefined) =>
    percent(label, value === undefined ? undefined : value * 100)

const elo = (label: string, value: number | undefined): Score | undefined =>
    value === undefined ? undefined : { label, value, displayValue: `${Math.round(value)}` }

// Each slot leads with its Artificial Analysis index and lists a single benchmark under
// it. A model without the index leads with that benchmark instead.
export const buildBenchmarkCards = (benchmarks: ModelBenchmarks | null): ModelBenchmarkCard[] => {
    if (!benchmarks) return []

    const slots: {
        key: ModelBenchmarkCard["key"]
        title: string
        index: Score | undefined
        benchmark: Score | undefined
    }[] = [
        {
            key: "intelligence",
            title: "Intelligence",
            index: percent("Artificial Analysis", benchmarks.intelligenceIndex),
            benchmark: accuracy("GPQA Diamond", benchmarks.gpqaDiamond)
        },
        {
            key: "coding",
            title: "Coding",
            index: percent("Artificial Analysis", benchmarks.codingIndex),
            benchmark: elo("Design Arena Code Elo", benchmarks.codeElo)
        },
        {
            key: "agentic",
            title: "Agentic",
            index: percent("Artificial Analysis", benchmarks.agenticIndex),
            benchmark: accuracy("τ²-Bench Airline", benchmarks.tauBenchAirline)
        }
    ]

    return slots.flatMap(({ key, title, index, benchmark }) => {
        const headline = index ?? benchmark
        if (!headline) return []

        return [
            {
                key,
                title,
                value: headline.value,
                displayValue: headline.displayValue,
                subtitle: headline.label,
                ...(index && benchmark
                    ? { breakdownLabel: benchmark.label, breakdownValue: benchmark.displayValue }
                    : {})
            }
        ]
    })
}
