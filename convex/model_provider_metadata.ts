import { v } from "convex/values"
import { internalMutation, internalQuery, query } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"
import { compactRoutingMetadata } from "./lib/model_routing_metadata"
import { toOpenRouterCatalogEntries } from "./lib/openrouter_catalog"
import { ModelProviderMetadata } from "./schema/model_provider_metadata"

export const getOpenRouterModelMetadataInternal = internalQuery({
    args: {
        providerModelIds: v.array(v.string())
    },
    handler: async (ctx, args) => {
        const uniqueIds = Array.from(new Set(args.providerModelIds.filter(Boolean)))
        const result: Record<string, unknown> = {}
        await Promise.all(
            uniqueIds.map(async (providerModelId) => {
                const metadata = await ctx.db
                    .query("modelProviderMetadata")
                    .withIndex("byProviderModel", (q) =>
                        q.eq("provider", "openrouter").eq("providerModelId", providerModelId)
                    )
                    .first()

                if (metadata) {
                    result[providerModelId] = metadata
                }
            })
        )

        return result
    }
})

export const upsertOpenRouterModelMetadataInternal = internalMutation({
    args: {
        models: v.array(ModelProviderMetadata)
    },
    handler: async (ctx, args) => {
        for (const model of args.models) {
            const compactModel = {
                ...model,
                ...(model.routing ? { routing: compactRoutingMetadata(model.routing) } : {})
            }
            const existing = await ctx.db
                .query("modelProviderMetadata")
                .withIndex("byProviderModel", (q) =>
                    q.eq("provider", "openrouter").eq("providerModelId", model.providerModelId)
                )
                .first()

            if (existing) {
                const routing =
                    existing.routing || compactModel.routing
                        ? compactRoutingMetadata({ ...existing.routing, ...compactModel.routing })
                        : undefined
                await ctx.db.replace(existing._id, {
                    ...compactModel,
                    ...(routing ? { routing } : {}),
                    // A count that couldn't be fetched this time keeps the last known one.
                    providerCount: compactModel.providerCount ?? existing.providerCount
                })
            } else {
                await ctx.db.insert("modelProviderMetadata", compactModel)
            }
        }

        return {
            upserted: args.models.length
        }
    }
})

// Marks rows for models missing from the latest full catalog. Runs after the upserts, which
// replace present rows and so clear any earlier removedAt.
export const markRemovedOpenRouterModelsInternal = internalMutation({
    args: {
        presentModelIds: v.array(v.string()),
        removedAt: v.number()
    },
    handler: async (ctx, args) => {
        const present = new Set(args.presentModelIds)
        const rows = await ctx.db
            .query("modelProviderMetadata")
            .withIndex("byProviderModel", (q) => q.eq("provider", "openrouter"))
            .collect()

        let marked = 0
        for (const row of rows) {
            if (present.has(row.providerModelId) || row.removedAt) continue
            await ctx.db.patch(row._id, { removedAt: args.removedAt })
            marked += 1
        }

        return { marked }
    }
})

// Slim OpenRouter catalog for prefilling custom models in Settings. The sync stores
// every catalog entry, not just built-ins.
export const listOpenRouterCatalog = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []

        const rows = await ctx.db
            .query("modelProviderMetadata")
            .withIndex("byProviderModel", (q) => q.eq("provider", "openrouter"))
            .collect()

        return toOpenRouterCatalogEntries(rows)
    }
})
