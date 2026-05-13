import { v } from "convex/values"

const GeneratedImageFacetCounts = v.object({
    modelIds: v.record(v.string(), v.number()),
    resolutions: v.record(v.string(), v.number()),
    aspectRatios: v.record(v.string(), v.number()),
    orientations: v.record(v.string(), v.number())
})

export const GeneratedImageFacets = v.object({
    userId: v.string(),
    active: GeneratedImageFacetCounts,
    archived: GeneratedImageFacetCounts,
    updatedAt: v.number()
})
