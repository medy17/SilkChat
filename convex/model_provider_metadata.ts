import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"
import { compactRoutingMetadata } from "./lib/model_routing_metadata"
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
                    ...(routing ? { routing } : {})
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
