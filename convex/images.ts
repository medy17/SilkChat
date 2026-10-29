import {
    type GeneratedImageFilterOptionCounts,
    type GeneratedImageFilters,
    getGeneratedImageFilterFields,
    getGeneratedImageFilterOptionsFromCounts,
    getGeneratedImageOrientation,
    hasActiveGeneratedImageFilters,
    matchesGeneratedImageFilters,
    normalizeGeneratedImageAspectRatio,
    normalizeGeneratedImageFilters
} from "@/lib/generated-image-filters"
import { buildGeneratedImageSearchText } from "@/lib/generated-image-search"
import { mergedStream, stream } from "convex-helpers/server/stream"
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
import { markReferenceUploadsUsed } from "./lib/reference_uploads"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import { getUserIdentity } from "./lib/identity"
import {
    getGeneratedImageSearchFilterFields,
    planGeneratedImageIndexScan
} from "./lib/generated_image_query_plan"
import schema from "./schema"

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
const GENERATED_IMAGE_PAGE_MAX_ROWS_READ = 2000
const GENERATED_IMAGE_PAGE_MAX_BYTES_READ = 8 * 1024 * 1024

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
        transparentBackground: v.optional(v.boolean()),
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

        // Real generations already marked these when their job was created; dev fake
        // generations only come through here.
        await markReferenceUploadsUsed(ctx, args.userId, args.referenceImageKeys)

        const { createdAt, ...rest } = args
        const image = {
            ...rest,
            ...getGeneratedImageFilterFields(rest.aspectRatio),
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
        const normalizedFilters = normalizeGeneratedImageFilters(
            filters as GeneratedImageFilters | undefined
        )
        const numItems = Math.max(1, Math.min(50, Math.floor(paginationOpts.numItems)))
        // Filters run before the page is cut, so a page only ends short when
        // the read budget runs out. The client continues from continueCursor
        // until the page is full or isDone.
        const readBudget = {
            maximumRowsRead: GENERATED_IMAGE_PAGE_MAX_ROWS_READ,
            maximumBytesRead: GENERATED_IMAGE_PAGE_MAX_BYTES_READ
        }

        if (effectiveQuery) {
            const filterFields = getGeneratedImageSearchFilterFields(normalizedFilters)
            const result = await ctx.db
                .query("generatedImages")
                .withSearchIndex("search_text", (q) => {
                    // biome-ignore lint/suspicious/noExplicitAny: filter fields are chosen at runtime.
                    let search: any = q.search("searchText", effectiveQuery).eq("userId", user.id)
                    if (view === "archived") search = search.eq("isArchived", true)
                    for (const { field, values } of filterFields) {
                        if (values.length === 1) search = search.eq(field, values[0])
                    }
                    return search
                })
                .filter((q) => {
                    const conditions = filterFields
                        .filter(({ values }) => values.length > 1)
                        .map(({ field, values }) =>
                            q.or(...values.map((value) => q.eq(q.field(field), value)))
                        )
                    // Missing and false both mean active.
                    if (view !== "archived") {
                        conditions.push(q.neq(q.field("isArchived"), true))
                    }
                    return conditions.length > 0 ? q.and(...conditions) : true
                })
                .paginate({ ...paginationOpts, numItems, ...readBudget })
            return {
                page: result.page,
                isDone: result.isDone,
                continueCursor: result.continueCursor
            }
        }

        // Missing and false both mean active; merge both ranges by date.
        const archiveStates = view === "archived" ? [true] : [undefined, false]
        const hasFilters = hasActiveGeneratedImageFilters(normalizedFilters)
        const facets = hasFilters ? await getGeneratedImageFacetsDoc(ctx, user.id) : null
        const plan = planGeneratedImageIndexScan({
            filters: normalizedFilters,
            archiveStateCount: archiveStates.length,
            counts: facets ? (view === "archived" ? facets.archived : facets.active) : undefined
        })
        const order = sortBy === "oldest" ? "asc" : "desc"
        const db = stream(ctx.db, schema)
        const ranges = archiveStates.flatMap((isArchived) =>
            plan.ranges.map((values) =>
                db
                    .query("generatedImages")
                    // biome-ignore lint/suspicious/noExplicitAny: the index is chosen at runtime from the plan.
                    .withIndex(plan.indexName as any, (q: any) => {
                        let range = q.eq("userId", user.id).eq("isArchived", isArchived)
                        plan.fields.forEach((field, index) => {
                            range = range.eq(field, values[index])
                        })
                        return range
                    })
                    .order(order)
            )
        )
        const merged = mergedStream(ranges, ["createdAt", "_creationTime", "_id"])
        const images = plan.needsRowFilter
            ? merged.filterWith(async (image) =>
                  matchesGeneratedImageFilters(image, normalizedFilters)
              )
            : merged
        const result = await images.paginate({ ...paginationOpts, numItems, ...readBudget })
        return {
            page: result.page,
            isDone: result.isDone,
            continueCursor: result.continueCursor
        }
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
