import type {
    GeneratedImageFilterOptionCounts,
    GeneratedImageFilters
} from "@/lib/generated-image-filters"

const FILTER_DIMENSIONS = [
    { key: "modelIds", field: "modelId", indexSegment: "Model" },
    { key: "resolutions", field: "resolution", indexSegment: "Resolution" },
    { key: "aspectRatios", field: "aspectRatioBucket", indexSegment: "Aspect" },
    { key: "orientations", field: "orientation", indexSegment: "Orientation" }
] as const

type FilterDimension = (typeof FILTER_DIMENSIONS)[number]

export type GeneratedImageFilterField = FilterDimension["field"]

// Each range is one index seek merged into the page stream. Past this, the
// least selective group is checked per row instead of expanding the product.
export const MAX_GENERATED_IMAGE_INDEX_RANGES = 64

export type GeneratedImageIndexScanPlan = {
    indexName: string
    fields: GeneratedImageFilterField[]
    // One tuple of values per index range, aligned with `fields`.
    ranges: string[][]
    // True when some selected group is not covered by the index prefix.
    needsRowFilter: boolean
}

// Convex caps index names at 64 characters, so combination indexes use a
// compact `byUserArchived<Groups>CreatedAt` form.
const getIndexName = (dimensions: FilterDimension[]) =>
    dimensions.length === 0
        ? "byUserIdAndIsArchivedAndCreatedAt"
        : `byUserArchived${dimensions.map((dimension) => dimension.indexSegment).join("")}CreatedAt`

const cartesianProduct = (lists: string[][]) =>
    lists.reduce<string[][]>(
        (product, values) => product.flatMap((prefix) => values.map((value) => [...prefix, value])),
        [[]]
    )

const sumCounts = (record: Record<string, number>, values?: string[]) =>
    (values ?? Object.keys(record)).reduce((total, value) => total + (record[value] ?? 0), 0)

/**
 * Picks the index whose exact ranges cover as many selected filter groups as
 * possible. With facet counts, the smallest estimated scan wins; without them,
 * every covered group is assumed to halve the scan.
 */
export const planGeneratedImageIndexScan = ({
    filters,
    archiveStateCount,
    counts
}: {
    filters: GeneratedImageFilters
    archiveStateCount: number
    counts?: GeneratedImageFilterOptionCounts
}): GeneratedImageIndexScanPlan => {
    const selected = FILTER_DIMENSIONS.filter((dimension) => filters[dimension.key]?.length)
    const total = counts
        ? Math.max(0, ...FILTER_DIMENSIONS.map((dimension) => sumCounts(counts[dimension.key])))
        : 0
    const getFraction = (dimension: FilterDimension) => {
        if (!counts) return 0.5
        if (total === 0) return 0
        return sumCounts(counts[dimension.key], filters[dimension.key]) / total
    }

    let best: { dimensions: FilterDimension[]; estimate: number; rangeCount: number } = {
        dimensions: [],
        estimate: 1,
        rangeCount: archiveStateCount
    }
    for (let mask = 1; mask < 1 << selected.length; mask++) {
        const dimensions = selected.filter((_, index) => mask & (1 << index))
        const rangeCount = dimensions.reduce(
            (count, dimension) => count * (filters[dimension.key]?.length ?? 1),
            archiveStateCount
        )
        if (rangeCount > MAX_GENERATED_IMAGE_INDEX_RANGES) continue

        const estimate = dimensions.reduce(
            (fraction, dimension) => fraction * getFraction(dimension),
            1
        )
        if (
            estimate < best.estimate ||
            (estimate === best.estimate && rangeCount < best.rangeCount)
        ) {
            best = { dimensions, estimate, rangeCount }
        }
    }

    return {
        indexName: getIndexName(best.dimensions),
        fields: best.dimensions.map((dimension) => dimension.field),
        ranges: cartesianProduct(
            best.dimensions.map((dimension) => [...(filters[dimension.key] ?? [])])
        ),
        needsRowFilter: best.dimensions.length < selected.length
    }
}

// Single-value groups narrow the search index exactly; multi-value groups
// become an OR filter on the stored fields.
export const getGeneratedImageSearchFilterFields = (filters: GeneratedImageFilters) =>
    FILTER_DIMENSIONS.flatMap((dimension) => {
        const values = filters[dimension.key]
        return values?.length ? [{ field: dimension.field, values: [...values] }] : []
    })
