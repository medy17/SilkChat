export type GeneratedImageOrientation = "portrait" | "landscape" | "square"

export type GeneratedImageFilters = {
    modelId?: string
    resolution?: string
    aspectRatio?: string
    orientation?: GeneratedImageOrientation
}

type FilterableGeneratedImage = {
    modelId?: string
    resolution?: string
    aspectRatio?: string
    createdAt: number
}

const normalizeValue = (value?: string | null) => {
    const normalized = value?.trim()
    return normalized && normalized !== "all" ? normalized : undefined
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
    modelId: normalizeValue(filters?.modelId),
    resolution: normalizeValue(filters?.resolution),
    aspectRatio: normalizeValue(filters?.aspectRatio),
    orientation:
        filters?.orientation === "portrait" ||
        filters?.orientation === "landscape" ||
        filters?.orientation === "square"
            ? filters.orientation
            : undefined
})

export const hasActiveGeneratedImageFilters = (filters?: GeneratedImageFilters | null) => {
    const normalized = normalizeGeneratedImageFilters(filters)
    return Boolean(
        normalized.modelId ||
            normalized.resolution ||
            normalized.aspectRatio ||
            normalized.orientation
    )
}

export const matchesGeneratedImageFilters = (
    image: Pick<FilterableGeneratedImage, "modelId" | "resolution" | "aspectRatio">,
    filters?: GeneratedImageFilters | null
) => {
    const normalized = normalizeGeneratedImageFilters(filters)

    if (normalized.modelId && image.modelId !== normalized.modelId) {
        return false
    }

    if (normalized.resolution && image.resolution !== normalized.resolution) {
        return false
    }

    if (normalized.aspectRatio && image.aspectRatio !== normalized.aspectRatio) {
        return false
    }

    if (
        normalized.orientation &&
        getGeneratedImageOrientation(image.aspectRatio) !== normalized.orientation
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
