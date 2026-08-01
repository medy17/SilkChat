"use node"

import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

type OpenRouterModel = {
    id?: unknown
    context_length?: unknown
    knowledge_cutoff?: unknown
    pricing?: {
        prompt?: unknown
        completion?: unknown
    }
    top_provider?: {
        max_completion_tokens?: unknown
    }
}

const parsePositiveNumber = (value: unknown) => {
    const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const pricePerTokenToPerMillion = (value: unknown) => {
    const parsed = parsePositiveNumber(value)
    return parsed === undefined ? undefined : Math.round(parsed * 1_000_000_000_000) / 1_000_000
}

const parseKnowledgeCutoff = (value: unknown) => {
    if (typeof value !== "string") return undefined

    const cutoff = value.trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(cutoff) ? cutoff : undefined
}

const normalizeOpenRouterModel = (model: OpenRouterModel, fetchedAt: number) => {
    if (typeof model.id !== "string" || !model.id.trim()) {
        return null
    }

    return {
        provider: "openrouter" as const,
        providerModelId: model.id,
        contextLength: parsePositiveNumber(model.context_length),
        maxCompletionTokens: parsePositiveNumber(model.top_provider?.max_completion_tokens),
        knowledgeCutoff: parseKnowledgeCutoff(model.knowledge_cutoff),
        inputUsdPer1MTokens: pricePerTokenToPerMillion(model.pricing?.prompt),
        outputUsdPer1MTokens: pricePerTokenToPerMillion(model.pricing?.completion),
        fetchedAt,
        source: "openrouter" as const
    }
}

export const syncOpenRouterModelMetadata = internalAction({
    args: {},
    handler: async (ctx) => {
        const response = await fetch(OPENROUTER_MODELS_URL, {
            headers: {
                Accept: "application/json"
            }
        })

        if (!response.ok) {
            throw new Error(`OpenRouter models fetch failed: ${response.status}`)
        }

        const payload = (await response.json()) as { data?: OpenRouterModel[] }
        const fetchedAt = Date.now()
        const models = (payload.data ?? [])
            .map((model) => normalizeOpenRouterModel(model, fetchedAt))
            .filter((model): model is NonNullable<typeof model> => model !== null)

        return await ctx.runMutation(
            internal.model_provider_metadata.upsertOpenRouterModelMetadataInternal,
            {
                models
            }
        )
    }
})
