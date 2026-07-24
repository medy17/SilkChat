"use node"

import { type OpenRouterProvider, createOpenRouter } from "@openrouter/ai-sdk-provider"

import { getOpenRouterAttribution } from "./openrouter_attribution"

const getInternalOpenRouterApiKey = () => process.env.OPENROUTER_API_KEY?.trim()

export const createProvider = (
    providerId: "openrouter",
    apiKey: string | "internal",
    options?: {
        modelId?: string
    }
): Promise<OpenRouterProvider> => {
    return createProviderInternal(providerId, apiKey, options)
}

const createProviderInternal = async (
    providerId: "openrouter",
    apiKey: string | "internal",
    _options?: {
        modelId?: string
    }
): Promise<OpenRouterProvider> => {
    if (apiKey !== "internal" && (!apiKey || apiKey.trim() === "")) {
        throw new Error("API key is required for non-internal providers")
    }

    switch (providerId) {
        case "openrouter": {
            const resolvedApiKey = apiKey === "internal" ? getInternalOpenRouterApiKey() : apiKey
            if (!resolvedApiKey) {
                throw new Error("OpenRouter API key is required")
            }

            return createOpenRouter({
                apiKey: resolvedApiKey,
                compatibility: "strict",
                ...getOpenRouterAttribution()
            })
        }
        default: {
            const exhaustiveCheck: never = providerId
            throw new Error(`Unknown provider: ${exhaustiveCheck}`)
        }
    }
}
