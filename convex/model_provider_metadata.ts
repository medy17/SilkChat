import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"

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
        models: v.array(
            v.object({
                provider: v.literal("openrouter"),
                providerModelId: v.string(),
                contextLength: v.optional(v.number()),
                maxCompletionTokens: v.optional(v.number()),
                inputUsdPer1MTokens: v.optional(v.number()),
                outputUsdPer1MTokens: v.optional(v.number()),
                fetchedAt: v.number(),
                source: v.literal("openrouter")
            })
        )
    },
    handler: async (ctx, args) => {
        for (const model of args.models) {
            const existing = await ctx.db
                .query("modelProviderMetadata")
                .withIndex("byProviderModel", (q) =>
                    q.eq("provider", "openrouter").eq("providerModelId", model.providerModelId)
                )
                .first()

            if (existing) {
                await ctx.db.patch(existing._id, model)
            } else {
                await ctx.db.insert("modelProviderMetadata", model)
            }
        }

        return {
            upserted: args.models.length
        }
    }
})
