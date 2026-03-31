export type GeneratedImageOrientation = "portrait" | "landscape" | "square"

export type GeneratedImageFilters = {
    modelIds?: string[]
    resolutions?: string[]
    aspectRatios?: string[]
    orientations?: GeneratedImageOrientation[]
}

type FilterableGeneratedImage = {
    modelId?: string
    resolution?: string
    aspectRatio?: string
    createdAt: number
}

const normalizeValues = (values?: string[] | null) => {
    if (!values?.length) return undefined

    const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    return normalized.length > 0 ? normalized : undefined
}

const normalizeOrientations = (values?: GeneratedImageOrientation[] | null) => {
    if (!values?.length) return undefined

    const normalized = [...new Set(values)].filter(
        (value): value is GeneratedImageOrientation =>
            value === "portrait" || value === "landscape" || value === "square"
    )

    return normalized.length > 0 ? normalized : undefined
}

const getAspectRatioValue = (aspectRatio?: string) => {
    if (!aspectRatio) return null

    if (aspectRatio.includes("x")) {
        const [width, height] = aspectRatio.split("x").map(Number)
        if (width > 0 && height > 0) {
            return width / height
        }
    }

    if (aspectRatio.includes(":")) {
        const [width, height] = aspectRatio.replace("-hd", "").split(":").map(Number)
        if (width > 0 && height > 0) {
            return width / height
        }
    }

    return null
}

export const getGeneratedImageOrientation = (
    aspectRatio?: string
): GeneratedImageOrientation | undefined => {
    const ratio = getAspectRatioValue(aspectRatio)
    if (ratio === null) return undefined
    if (Math.abs(ratio - 1) < 0.001) return "square"
    return ratio > 1 ? "landscape" : "portrait"
}

export const normalizeGeneratedImageFilters = (
    filters?: GeneratedImageFilters | null
): GeneratedImageFilters => ({
    modelIds: normalizeValues(filters?.modelIds),
    resolutions: normalizeValues(filters?.resolutions),
    aspectRatios: normalizeValues(filters?.aspectRatios),
    orientations: normalizeOrientations(filters?.orientations)
})

export const hasActiveGeneratedImageFilters = (filters?: GeneratedImageFilters | null) => {
    const normalized = normalizeGeneratedImageFilters(filters)
    return Boolean(
        normalized.modelIds?.length ||
            normalized.resolutions?.length ||
            normalized.aspectRatios?.length ||
            normalized.orientations?.length
    )
}

export const matchesGeneratedImageFilters = (
    image: Pick<FilterableGeneratedImage, "modelId" | "resolution" | "aspectRatio">,
    filters?: GeneratedImageFilters | null
) => {
    const normalized = normalizeGeneratedImageFilters(filters)

    if (normalized.modelIds?.length && !normalized.modelIds.includes(image.modelId ?? "")) {
        return false
    }

    if (
        normalized.resolutions?.length &&
        !normalized.resolutions.includes(image.resolution ?? "")
    ) {
        return false
    }

    if (
        normalized.aspectRatios?.length &&
        !normalized.aspectRatios.includes(image.aspectRatio ?? "")
    ) {
        return false
    }

    if (
        normalized.orientations?.length &&
        !normalized.orientations.includes(
            getGeneratedImageOrientation(image.aspectRatio) ?? "square"
        )
    ) {
        return false
    }

    return true
}

const sortStrings = (values: Iterable<string>) => [...values].sort((a, b) => a.localeCompare(b))

const sortAspectRatios = (values: Iterable<string>) =>
    [...values].sort((a, b) => {
        const aRatio = getAspectRatioValue(a)
        const bRatio = getAspectRatioValue(b)

        if (aRatio !== null && bRatio !== null && aRatio !== bRatio) {
            return bRatio - aRatio
        }

        if (aRatio !== null && bRatio === null) return -1
        if (aRatio === null && bRatio !== null) return 1
        return a.localeCompare(b)
    })

const ORIENTATION_ORDER: GeneratedImageOrientation[] = ["landscape", "portrait", "square"]

export const getGeneratedImageFilterOptions = (
    images: Array<Pick<FilterableGeneratedImage, "modelId" | "resolution" | "aspectRatio">>
) => {
    const modelIds = new Set<string>()
    const resolutions = new Set<string>()
    const aspectRatios = new Set<string>()
    const orientations = new Set<GeneratedImageOrientation>()

    for (const image of images) {
        if (image.modelId) modelIds.add(image.modelId)
        if (image.resolution) resolutions.add(image.resolution)
        if (image.aspectRatio) aspectRatios.add(image.aspectRatio)

        const orientation = getGeneratedImageOrientation(image.aspectRatio)
        if (orientation) orientations.add(orientation)
    }

    return {
        modelIds: sortStrings(modelIds),
        resolutions: sortStrings(resolutions),
        aspectRatios: sortAspectRatios(aspectRatios),
        orientations: ORIENTATION_ORDER.filter((orientation) => orientations.has(orientation))
    }
}

export const filterAndSortGeneratedImages = <T extends FilterableGeneratedImage>(
    images: T[],
    {
        filters,
        sortBy = "newest"
    }: {
        filters?: GeneratedImageFilters | null
        sortBy?: "newest" | "oldest"
    }
) =>
    images
        .filter((image) => matchesGeneratedImageFilters(image, filters))
        .sort((a, b) =>
            sortBy === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
        )
