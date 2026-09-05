import {
    type GeneratedImageFilterOptionCounts,
    type GeneratedImageFilters,
    filterAndSortGeneratedImages,
    getGeneratedImageFilterOptionsFromCounts,
    getGeneratedImageOrientation,
    matchesGeneratedImageFilters,
    normalizeGeneratedImageAspectRatio
} from "@/lib/generated-image-filters"
import { buildGeneratedImageSearchText } from "@/lib/generated-image-search"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { getUserIdentity } from "./lib/identity"

type ImageFacetCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">
type GeneratedImageFacetSnapshot = ReturnType<typeof createEmptyFacetSnapshot>
type GeneratedImageFacetImage = Pick<
    Doc<"generatedImages">,
    "modelId" | "resolution" | "aspectRatio" | "isArchived"
>

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

const createEmptyFacetCounts = (): GeneratedImageFilterOptionCounts => ({
    modelIds: {},
    resolutions: {},
    aspectRatios: {},
    orientations: {}
})

const createEmptyFacetSnapshot = () => ({
    active: createEmptyFacetCounts(),
    archived: createEmptyFacetCounts()
})

const cloneFacetCounts = (
    counts: GeneratedImageFilterOptionCounts
): GeneratedImageFilterOptionCounts => ({
    modelIds: { ...counts.modelIds },
    resolutions: { ...counts.resolutions },
    aspectRatios: { ...counts.aspectRatios },
    orientations: { ...counts.orientations }
})

const cloneFacetSnapshot = (snapshot: ReturnType<typeof createEmptyFacetSnapshot>) => ({
    active: cloneFacetCounts(snapshot.active),
    archived: cloneFacetCounts(snapshot.archived)
})

const updateFacetCountRecord = (
    record: Record<string, number>,
    value: string | undefined,
    delta: 1 | -1
) => {
    if (!value) return

    const next = (record[value] ?? 0) + delta
    if (next <= 0) {
        delete record[value]
        return
    }

    record[value] = next
}

const applyImageToFacetCounts = (
    counts: GeneratedImageFilterOptionCounts,
    image: {
        modelId?: string
        resolution?: string
        aspectRatio?: string
    },
    delta: 1 | -1
) => {
    updateFacetCountRecord(counts.modelIds, image.modelId, delta)
    updateFacetCountRecord(counts.resolutions, image.resolution, delta)
    updateFacetCountRecord(
        counts.aspectRatios,
        normalizeGeneratedImageAspectRatio(image.aspectRatio),
        delta
    )
    updateFacetCountRecord(
        counts.orientations,
        getGeneratedImageOrientation(image.aspectRatio),
        delta
    )
}

const getFacetSnapshotForImage = (
    snapshot: GeneratedImageFacetSnapshot,
    image: { isArchived?: boolean }
) => (image.isArchived === true ? snapshot.archived : snapshot.active)

const getGeneratedImageFacetsDoc = async (ctx: ImageFacetCtx, userId: string) =>
    await ctx.db
        .query("generatedImageFacets")
        .withIndex("byUserId", (q) => q.eq("userId", userId))
        .first()

const patchGeneratedImageFacets = async (
    ctx: MutationCtx,
    userId: string,
    update: (snapshot: GeneratedImageFacetSnapshot) => void,
    options?: {
        rebuildIfMissing?: boolean
    }
) => {
    const existing = await getGeneratedImageFacetsDoc(ctx, userId)
    if (!existing && options?.rebuildIfMissing) {
        await rebuildGeneratedImageFacets(ctx, userId)
        return null
    }

    const snapshot = existing
        ? cloneFacetSnapshot({
              active: existing.active,
              archived: existing.archived
          })
        : createEmptyFacetSnapshot()

    update(snapshot)

    const payload = {
        userId,
        active: snapshot.active,
        archived: snapshot.archived,
        updatedAt: Date.now()
    }

    if (existing) {
        await ctx.db.patch(existing._id, payload)
        return existing._id
    }

    return await ctx.db.insert("generatedImageFacets", payload)
}

const buildGeneratedImageFacetSnapshot = (images: GeneratedImageFacetImage[]) => {
    const snapshot = createEmptyFacetSnapshot()
    for (const image of images) {
        applyImageToFacetCounts(getFacetSnapshotForImage(snapshot, image), image, 1)
    }

    return snapshot
}

const rebuildGeneratedImageFacets = async (ctx: MutationCtx, userId: string) => {
    const images = await ctx.db
        .query("generatedImages")
        .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", userId))
        .collect()

    const snapshot = buildGeneratedImageFacetSnapshot(images)

    await patchGeneratedImageFacets(ctx, userId, (next) => {
        next.active = snapshot.active
        next.archived = snapshot.archived
    })

    return snapshot
}

export const insertGeneratedImage = internalMutation({
    args: {
        userId: v.string(),
        storageKey: v.string(),
        prompt: v.optional(v.string()),
        modelId: v.optional(v.string()),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        referenceImageKeys: v.optional(v.array(v.string())),
        generationJobId: v.optional(v.id("imageGenerationJobs")),
        falRequestId: v.optional(v.string()),
        createdAt: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        await assertAccountNotDeleting(ctx, args.userId)

        if (args.generationJobId) {
            const existing = await ctx.db
                .query("generatedImages")
                .withIndex("byGenerationJobIdAndStorageKey", (q) =>
                    q.eq("generationJobId", args.generationJobId).eq("storageKey", args.storageKey)
                )
                .first()
            if (existing) return existing._id
        }

        const { createdAt, ...rest } = args
        const image = {
            ...rest,
            searchText: buildGeneratedImageSearchText(rest),
            createdAt: createdAt ?? Date.now()
        }
        const id = await ctx.db.insert("generatedImages", image)

        await patchGeneratedImageFacets(
            ctx,
            args.userId,
            (snapshot) => {
                applyImageToFacetCounts(snapshot.active, image, 1)
            },
            { rebuildIfMissing: true }
        )

        return id
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

export const listGeneratedImagesByIds = query({
    args: {
        ids: v.array(v.id("generatedImages"))
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []

        const images = await Promise.all(args.ids.map((id) => ctx.db.get(id)))
        const imageById = new Map(
            images
                .filter((image): image is NonNullable<(typeof images)[number]> =>
                    Boolean(image && image.userId === user.id)
                )
                .map((image) => [image._id, image])
        )

        return args.ids.map((id) => imageById.get(id)).filter((image) => image !== undefined)
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
        // Preserve Convex's opaque cursor and split metadata. Never convert a
        // requested page into a growing read from the start of the index.
        const imagesQuery = effectiveQuery
            ? ctx.db
                  .query("generatedImages")
                  .withSearchIndex("search_text", (q) =>
                      q.search("searchText", effectiveQuery).eq("userId", user.id)
                  )
            : view === "archived"
              ? ctx.db
                    .query("generatedImages")
                    .withIndex("byUserIdAndIsArchivedAndCreatedAt", (q) =>
                        q.eq("userId", user.id).eq("isArchived", true)
                    )
                    .order(sortBy === "oldest" ? "asc" : "desc")
              : ctx.db
                    .query("generatedImages")
                    .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
                    .order(sortBy === "oldest" ? "asc" : "desc")
        // Missing and false both mean active. Keep their shared chronological
        // order rather than separating them into distinct archive-index ranges.
        const visibleQuery =
            effectiveQuery || view === "archived"
                ? imagesQuery
                : imagesQuery.filter((q) => q.neq(q.field("isArchived"), true))
        const result = await visibleQuery.paginate({
            ...paginationOpts,
            numItems: Math.max(1, Math.min(50, Math.floor(paginationOpts.numItems))),
            maximumRowsRead: 512,
            maximumBytesRead: 2 * 1024 * 1024
        })
        // Computed and multi-select filters apply to this bounded page only.
        // An empty page is not necessarily exhaustion.
        return {
            ...result,
            page: result.page.filter(
                (image) =>
                    isImageVisibleInView(image, view) &&
                    matchesGeneratedImageFilters(
                        image,
                        filters as GeneratedImageFilters | undefined
                    )
            )
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

        const facets = await getGeneratedImageFacetsDoc(ctx, user.id)
        if (facets) {
            return getGeneratedImageFilterOptionsFromCounts(
                view === "archived" ? facets.archived : facets.active
            )
        }

        const images = await ctx.db
            .query("generatedImages")
            .withIndex("byUserIdAndCreatedAt", (q) => q.eq("userId", user.id))
            .collect()
        const snapshot = buildGeneratedImageFacetSnapshot(images)
        return getGeneratedImageFilterOptionsFromCounts(
            view === "archived" ? snapshot.archived : snapshot.active
        )
    }
})

export const archiveGeneratedImage = mutation({
    args: { id: v.id("generatedImages") },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("unauthorized:chat")
        await assertAccountNotDeleting(ctx, user.id)

        const image = await ctx.db.get(args.id)
        if (!image) throw new Error("Image not found")
        if (image.userId !== user.id) throw new Error("Unauthorized to archive this image")
        if (image.isArchived === true) return

        await ctx.db.patch(args.id, {
            isArchived: true
        })

        await patchGeneratedImageFacets(
            ctx,
            image.userId,
            (snapshot) => {
                applyImageToFacetCounts(snapshot.active, image, -1)
                applyImageToFacetCounts(snapshot.archived, image, 1)
            },
            { rebuildIfMissing: true }
        )
    }
})

export const restoreGeneratedImage = mutation({
    args: { id: v.id("generatedImages") },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("unauthorized:chat")
        await assertAccountNotDeleting(ctx, user.id)

        const image = await ctx.db.get(args.id)
        if (!image) throw new Error("Image not found")
        if (image.userId !== user.id) throw new Error("Unauthorized to restore this image")
        if (image.isArchived !== true) return

        await ctx.db.patch(args.id, {
            isArchived: false
        })

        await patchGeneratedImageFacets(
            ctx,
            image.userId,
            (snapshot) => {
                applyImageToFacetCounts(snapshot.archived, image, -1)
                applyImageToFacetCounts(snapshot.active, image, 1)
            },
            { rebuildIfMissing: true }
        )
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
        const image = await ctx.db.get(args.id)
        if (!image) return

        await ctx.db.delete(args.id)

        await patchGeneratedImageFacets(
            ctx,
            image.userId,
            (snapshot) => {
                applyImageToFacetCounts(getFacetSnapshotForImage(snapshot, image), image, -1)
            },
            { rebuildIfMissing: true }
        )
    }
})

export const rebuildGeneratedImageFacetsInternal = internalMutation({
    args: {
        userId: v.string()
    },
    handler: async (ctx, args) => {
        await rebuildGeneratedImageFacets(ctx, args.userId)
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
