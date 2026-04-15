import {
    type GeneratedImageFilters,
    filterAndSortGeneratedImages,
    getGeneratedImageFilterOptions,
    matchesGeneratedImageFilters
} from "@/lib/generated-image-filters"
import { buildGeneratedImageSearchText } from "@/lib/generated-image-search"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"

const generatedImageSortValidator = v.union(
    v.literal("relevance"),
    v.literal("newest"),
    v.literal("oldest")
)
const generatedImageOrientationValidator = v.union(
    v.literal("portrait"),
    v.literal("landscape"),
    v.literal("square")
)
const generatedImageFiltersValidator = v.optional(
    v.object({
        modelIds: v.optional(v.array(v.string())),
        resolutions: v.optional(v.array(v.string())),
        aspectRatios: v.optional(v.array(v.string())),
        orientations: v.optional(v.array(generatedImageOrientationValidator))
    })
)
const generatedImageViewValidator = v.optional(v.union(v.literal("active"), v.literal("archived")))
const MIN_GENERATED_IMAGE_SEARCH_QUERY_LENGTH = 2

const isImageVisibleInView = (
    image: {
        isArchived?: boolean
    },
    view?: "active" | "archived"
) => {
    if (view === "archived") {
        return image.isArchived === true
    }

    return image.isArchived !== true
}

export const insertGeneratedImage = internalMutation({
    args: {
        userId: v.string(),
        storageKey: v.string(),
        prompt: v.optional(v.string()),
        modelId: v.optional(v.string()),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        createdAt: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const { createdAt, ...rest } = args
        return await ctx.db.insert("generatedImages", {
            ...rest,
            searchText: buildGeneratedImageSearchText(rest),
            createdAt: createdAt ?? Date.now()
        })
    }
})

export const listGeneratedImagesInternal = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("generatedImages")
            .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", args.userId))
            .collect()
    }
})

export const listGeneratedImages = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []

        const images = await ctx.db
            .query("generatedImages")
            .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
            .order("desc")
            .collect()

        return images
    }
})

export const paginateGeneratedImages = query({
    args: {
        paginationOpts: paginationOptsValidator,
        query: v.optional(v.string()),
        sortBy: v.optional(generatedImageSortValidator),
        filters: generatedImageFiltersValidator,
        view: generatedImageViewValidator
    },
    handler: async (ctx, { paginationOpts, query, sortBy, filters, view }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return {
                page: [],
                isDone: true,
                continueCursor: ""
            }
        }

        const trimmedQuery = query?.trim()
        const effectiveQuery =
            trimmedQuery && trimmedQuery.length >= MIN_GENERATED_IMAGE_SEARCH_QUERY_LENGTH
                ? trimmedQuery
                : undefined
        const normalizedSortBy =
            sortBy === "relevance" && !effectiveQuery ? "newest" : (sortBy ?? "newest")
        const chronologicalSortBy = normalizedSortBy === "relevance" ? "newest" : normalizedSortBy

        const filteredImages = effectiveQuery
            ? await ctx.db
                  .query("generatedImages")
                  .withSearchIndex("search_text", (q) =>
                      q.search("searchText", effectiveQuery).eq("userId", user.id)
                  )
                  .collect()
                  .then((images) => {
                      const matchedImages = images.filter(
                          (image) =>
                              isImageVisibleInView(image, view) &&
                              matchesGeneratedImageFilters(
                                  image,
                                  filters as GeneratedImageFilters | undefined
                              )
                      )

                      if (normalizedSortBy === "relevance") {
                          return matchedImages
                      }

                      return filterAndSortGeneratedImages(matchedImages, {
                          sortBy: chronologicalSortBy
                      })
                  })
            : await ctx.db
                  .query("generatedImages")
                  .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
                  .collect()
                  .then((images) =>
                      filterAndSortGeneratedImages(
                          images.filter((image) => isImageVisibleInView(image, view)),
                          {
                              filters: filters as GeneratedImageFilters | undefined,
                              sortBy: chronologicalSortBy
                          }
                      )
                  )

        const cursorOffset = Number(paginationOpts.cursor || "0")
        const startIndex =
            Number.isFinite(cursorOffset) && cursorOffset >= 0 ? Math.floor(cursorOffset) : 0
        const page = filteredImages.slice(startIndex, startIndex + paginationOpts.numItems)
        const nextOffset = startIndex + page.length
        const isDone = nextOffset >= filteredImages.length

        return {
            page,
            isDone,
            continueCursor: isDone ? "" : String(nextOffset)
        }
    }
})

export const getGeneratedImagesCount = query({
    args: {
        query: v.optional(v.string()),
        filters: generatedImageFiltersValidator,
        view: generatedImageViewValidator
    },
    handler: async (ctx, { query, filters, view }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return 0

        const trimmedQuery = query?.trim()
        const effectiveQuery =
            trimmedQuery && trimmedQuery.length >= MIN_GENERATED_IMAGE_SEARCH_QUERY_LENGTH
                ? trimmedQuery
                : undefined

        if (effectiveQuery) {
            const images = await ctx.db
                .query("generatedImages")
                .withSearchIndex("search_text", (q) =>
                    q.search("searchText", effectiveQuery).eq("userId", user.id)
                )
                .collect()

            return images.filter(
                (image) =>
                    isImageVisibleInView(image, view) &&
                    matchesGeneratedImageFilters(
                        image,
                        filters as GeneratedImageFilters | undefined
                    )
            ).length
        }

        const images = await ctx.db
            .query("generatedImages")
            .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
            .collect()

        return filterAndSortGeneratedImages(
            images.filter((image) => isImageVisibleInView(image, view)),
            {
                filters: filters as GeneratedImageFilters | undefined
            }
        ).length
    }
})

export const getGeneratedImageFacetOptions = query({
    args: {
        view: generatedImageViewValidator
    },
    handler: async (ctx, { view }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return {
                modelIds: [],
                resolutions: [],
                aspectRatios: [],
                orientations: []
            }
        }

        const images = await ctx.db
            .query("generatedImages")
            .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
            .collect()

        return getGeneratedImageFilterOptions(
            images.filter((image) => isImageVisibleInView(image, view))
        )
    }
})

export const archiveGeneratedImage = mutation({
    args: { id: v.id("generatedImages") },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("unauthorized:chat")

        const image = await ctx.db.get(args.id)
        if (!image) throw new Error("Image not found")
        if (image.userId !== user.id) throw new Error("Unauthorized to archive this image")

        await ctx.db.patch(args.id, {
            isArchived: true
        })
    }
})

export const restoreGeneratedImage = mutation({
    args: { id: v.id("generatedImages") },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("unauthorized:chat")

        const image = await ctx.db.get(args.id)
        if (!image) throw new Error("Image not found")
        if (image.userId !== user.id) throw new Error("Unauthorized to restore this image")

        await ctx.db.patch(args.id, {
            isArchived: false
        })
    }
})

export const getGeneratedImageInternal = internalQuery({
    args: { id: v.id("generatedImages") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id)
    }
})

export const removeGeneratedImageInternal = internalMutation({
    args: { id: v.id("generatedImages") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id)
    }
})

export const updateGeneratedImageSearchTextInternal = internalMutation({
    args: {
        id: v.id("generatedImages"),
        searchText: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            searchText: args.searchText
        })
    }
})
