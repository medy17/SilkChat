import type { GeneratedImageOrientation } from "@/lib/generated-image-filters"

export type ImageSortOption = "newest" | "oldest"

export type LibraryFiltersState = {
    modelIds: string[]
    resolutions: string[]
    aspectRatios: string[]
    orientations: GeneratedImageOrientation[]
}

export type LibrarySearchState = LibraryFiltersState & {
    page: number
    sort: ImageSortOption
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFiltersState = {
    modelIds: [],
    resolutions: [],
    aspectRatios: [],
    orientations: []
}

export const DEFAULT_LIBRARY_SEARCH: LibrarySearchState = {
    page: 1,
    sort: "newest",
    ...DEFAULT_LIBRARY_FILTERS
}

const GENERATED_IMAGE_ORIENTATIONS = new Set<GeneratedImageOrientation>([
    "landscape",
    "portrait",
    "square"
])

const getFirstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value)

const normalizePositiveInteger = (value: unknown) => {
    const candidate = getFirstValue(value)
    const parsed =
        typeof candidate === "number"
            ? candidate
            : typeof candidate === "string"
              ? Number(candidate)
              : Number.NaN

    if (!Number.isFinite(parsed) || parsed < 1) {
        return DEFAULT_LIBRARY_SEARCH.page
    }

    return Math.floor(parsed)
}

const normalizeStringArray = (value: unknown) => {
    const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
    const seen = new Set<string>()

    return values.filter((entry): entry is string => {
        if (typeof entry !== "string" || entry.length === 0 || seen.has(entry)) {
            return false
        }

        seen.add(entry)
        return true
    })
}

const isGeneratedImageOrientation = (value: string): value is GeneratedImageOrientation =>
    GENERATED_IMAGE_ORIENTATIONS.has(value as GeneratedImageOrientation)

export const cloneLibraryFilters = (filters: LibraryFiltersState): LibraryFiltersState => ({
    modelIds: [...filters.modelIds],
    resolutions: [...filters.resolutions],
    aspectRatios: [...filters.aspectRatios],
    orientations: [...filters.orientations]
})

export const getLibraryFiltersFromSearch = (search: LibrarySearchState): LibraryFiltersState =>
    cloneLibraryFilters(search)

export const validateLibrarySearch = (search: Record<string, unknown>): LibrarySearchState => ({
    page: normalizePositiveInteger(search.page),
    sort: getFirstValue(search.sort) === "oldest" ? "oldest" : DEFAULT_LIBRARY_SEARCH.sort,
    modelIds: normalizeStringArray(search.modelIds),
    resolutions: normalizeStringArray(search.resolutions),
    aspectRatios: normalizeStringArray(search.aspectRatios),
    orientations: normalizeStringArray(search.orientations).filter(isGeneratedImageOrientation)
})
