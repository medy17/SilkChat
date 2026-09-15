import type { ModelRoutingMetadata, ModelRoutingMode } from "../schema/model_routing"

export const DEFAULT_MODEL_ROUTING: ModelRoutingMode = "silkchat"

export const MODEL_ROUTING_OPTIONS = [
    {
        value: "silkchat",
        label: "Let SilkChat choose",
        description:
            "Best overall balance. We choose providers based on moderation leniency, price, and reliability."
    },
    {
        value: "zdr",
        label: "Zero Data Retention",
        description: "A privacy-first approach. Only use providers with zero data retention."
    },
    {
        value: "floor",
        label: "Lowest Cost",
        description:
            "Get more usage. Cheapest rates but responses might be used for training by some providers."
    }
] as const

export const getRoutingUnavailableReason = (mode: ModelRoutingMode) =>
    mode === "zdr" ? "No ZDR providers available." : "No providers available for this routing mode."

export const getOpenRouterRouting = (
    mode: ModelRoutingMode = DEFAULT_MODEL_ROUTING,
    preferredProviders?: string[]
) => ({
    require_parameters: true,
    ...(mode === "zdr" ? { zdr: true } : {}),
    ...(mode === "silkchat" && preferredProviders?.length
        ? { order: preferredProviders, allow_fallbacks: true }
        : {})
})

export const getRoutedOpenRouterModelId = (
    modelId: string,
    mode: ModelRoutingMode = DEFAULT_MODEL_ROUTING
) => {
    // Replace routing variants, preserving semantic variants such as :thinking.
    const base = modelId.replace(/:(floor|nitro)\b/g, "")
    return mode === "floor" ? `${base}:floor` : base
}

export const applyModelRouting = <
    T extends {
        routing?: ModelRoutingMetadata
        inputUsdPer1MTokens?: number
        outputUsdPer1MTokens?: number
        contextLength?: number
        maxTokens?: number
    }
>(
    model: T,
    mode: ModelRoutingMode = DEFAULT_MODEL_ROUTING
) => {
    const summary = model.routing?.[mode]
    const clampLimit = (configured: number | undefined, endpointLimit: number | undefined) =>
        endpointLimit === undefined
            ? configured
            : Math.min(configured ?? endpointLimit, endpointLimit)
    return {
        ...model,
        contextLength: clampLimit(model.contextLength, summary?.contextLength),
        maxTokens: clampLimit(model.maxTokens, summary?.maxCompletionTokens),
        // Do not present another mode's prices as this mode's estimate.
        ...(model.routing || mode !== "silkchat"
            ? {
                  inputUsdPer1MTokens: summary?.pricing?.inputUsdPer1MTokens,
                  outputUsdPer1MTokens: summary?.pricing?.outputUsdPer1MTokens
              }
            : {}),
        routingMode: mode,
        routingUnavailableReason:
            summary?.available === false ? getRoutingUnavailableReason(mode) : undefined
    }
}
