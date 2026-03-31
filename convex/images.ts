import {
    type GeneratedImageFilters,
    filterAndSortGeneratedImages,
    getGeneratedImageFilterOptions
} from "@/lib/generated-image-filters"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internalMutation, internalQuery, query } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"

const generatedImageSortValidator = v.union(v.literal("newest"), v.literal("oldest"))
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
        sortBy: v.optional(generatedImageSortValidator),
        filters: generatedImageFiltersValidator
    },
    handler: async (ctx, { paginationOpts, sortBy, filters }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return {
                page: [],
                isDone: true,
                continueCursor: ""
            }
        }

        const images = await ctx.db
            .query("generatedImages")
            .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
            .collect()

        const filteredImages = filterAndSortGeneratedImages(images, {
            filters: filters as GeneratedImageFilters | undefined,
            sortBy
        })

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
        filters: generatedImageFiltersValidator
    },
    handler: async (ctx, { filters }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return 0

        const images = await ctx.db
            .query("generatedImages")
            .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
            .collect()

        return filterAndSortGeneratedImages(images, {
            filters: filters as GeneratedImageFilters | undefined
        }).length
    }
})

export const getGeneratedImageFacetOptions = query({
    args: {},
    handler: async (ctx) => {
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

        return getGeneratedImageFilterOptions(images)
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
