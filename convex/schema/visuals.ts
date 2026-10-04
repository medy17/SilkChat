import { v } from "convex/values"

export const StoredVisual = v.object({
    id: v.string(),
    title: v.string(),
    thumbnailUrl: v.string(),
    sourceUrl: v.string(),
    source: v.string(),
    originalUrl: v.string(),
    storageKey: v.string(),
    confidence: v.optional(v.string()),
    pageFetched: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number())
})

export const VisualSelection = v.object({
    key: v.string(),
    cue: v.string(),
    visuals: v.array(StoredVisual)
})

export const VisualSearchRun = v.object({
    userId: v.string(),
    messageDocId: v.id("messages"),
    requestKey: v.string(),
    query: v.string(),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
    assets: v.array(StoredVisual),
    alteredQuery: v.optional(v.string()),
    strictWarning: v.optional(v.boolean()),
    expiresAt: v.number()
})
