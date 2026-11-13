// Scores from OpenRouter's unified benchmarks feed, kept in the units the feed uses:
// Artificial Analysis indices are 0-100, accuracies are 0-1, and Elo is a rating.
export type ModelBenchmarks = {
    intelligenceIndex?: number
    codingIndex?: number
    agenticIndex?: number
    gpqaDiamond?: number
    tauBenchAirline?: number
    codeElo?: number
    asOf: number
}

type BenchmarkScore = Exclude<keyof ModelBenchmarks, "asOf">

const finite = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined

const getScores = (row: Record<string, unknown>): [BenchmarkScore, number | undefined][] => {
    if (row.source === "artificial-analysis") {
        return [
            ["intelligenceIndex", finite(row.intelligence_index)],
            ["codingIndex", finite(row.coding_index)],
            ["agenticIndex", finite(row.agentic_index)]
        ]
    }
    if (row.source === "openrouter") {
        if (row.benchmark_type === "gpqa_diamond") return [["gpqaDiamond", finite(row.accuracy)]]
        if (row.benchmark_type === "tau_bench_verified_airline") {
            return [["tauBenchAirline", finite(row.accuracy)]]
        }
        return []
    }
    if (row.source === "design-arena" && row.arena === "models") {
        return row.category === "codecategories" ? [["codeElo", finite(row.elo)]] : []
    }
    return []
}

// Scores keyed by the feed's `model_permaslug`, which is the catalog's `canonical_slug`.
// A model can have several rows for one benchmark (one per reasoning setting); the best
// score is kept.
export const parseOpenRouterBenchmarks = (
    payload: unknown,
    fetchedAt: number
): Map<string, ModelBenchmarks> => {
    const { data, meta } = (payload ?? {}) as { data?: unknown; meta?: { as_of?: unknown } }
    if (!Array.isArray(data)) throw new Error("Invalid OpenRouter benchmarks payload")

    const parsedAsOf = typeof meta?.as_of === "string" ? Date.parse(meta.as_of) : Number.NaN
    const asOf = Number.isFinite(parsedAsOf) ? parsedAsOf : fetchedAt

    const benchmarks = new Map<string, ModelBenchmarks>()
    for (const row of data) {
        if (!row || typeof row !== "object") continue
        const slug = (row as { model_permaslug?: unknown }).model_permaslug
        if (typeof slug !== "string" || !slug) continue

        for (const [key, score] of getScores(row as Record<string, unknown>)) {
            if (score === undefined) continue
            const entry = benchmarks.get(slug) ?? { asOf }
            entry[key] = Math.max(entry[key] ?? Number.NEGATIVE_INFINITY, score)
            benchmarks.set(slug, entry)
        }
    }
    return benchmarks
}
