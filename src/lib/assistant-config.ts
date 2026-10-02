import type { SharedModel } from "@/convex/lib/models"
import { resolveModelReplacement } from "@/convex/lib/models/lifecycle"
import type { ReasoningEffort } from "@/lib/model-store"
import { getReasoningEffortForPlan } from "@/lib/models-providers-shared"
import { MAX_TOOL_CALL_LIMIT_PER_TURN, MIN_TOOL_CALL_LIMIT_PER_TURN } from "@/lib/tool-call-limit"
import type { AbilityId } from "@/lib/tool-abilities"

export type GenerationConfig = {
    modelId: string
    reasoningEffort: ReasoningEffort
    enabledTools: AbilityId[]
    autoSelectTools: boolean
    toolCallLimitPerTurn?: number
    resolvedToolCallLimitPerTurn?: number
    resolvedTools?: AbilityId[]
}

type AssistantConfigCarrier = {
    role: string
    id?: string
    metadata?: {
        modelId?: string
        reasoningEffort?: ReasoningEffort
        generationConfig?: GenerationConfig
    }
}

export type AssistantConfigOverride = {
    modelIdOverride?: string
    reasoningEffortOverride?: ReasoningEffort
    toolCallLimitFloorOverride?: number
    generationConfigOverride?: GenerationConfig
}

export const getAssistantConfigFromMessage = (message: AssistantConfigCarrier | undefined) => {
    if (message?.role !== "assistant") return null

    const generationConfig = message.metadata?.generationConfig
    const modelId = generationConfig?.modelId ?? message.metadata?.modelId
    const reasoningEffort = generationConfig?.reasoningEffort ?? message.metadata?.reasoningEffort

    if (!modelId && !reasoningEffort) {
        return null
    }

    return {
        modelId,
        reasoningEffort,
        generationConfig
    }
}

export const getLatestAssistantConfig = (messages: AssistantConfigCarrier[]) =>
    [...messages]
        .reverse()
        .map((message) => getAssistantConfigFromMessage(message))
        .find((config) => config !== null) ?? null

export const getRetryTargetAssistantConfig = (
    messages: AssistantConfigCarrier[],
    userMessageId: string
) => {
    const userMessageIndex = messages.findIndex(
        (message) => message.id === userMessageId && message.role === "user"
    )
    if (userMessageIndex === -1) return null

    for (const message of messages.slice(userMessageIndex + 1)) {
        if (message.role === "user") break
        const config = getAssistantConfigFromMessage(message)
        if (config) return config
    }
    const generationConfig = messages[userMessageIndex].metadata?.generationConfig
    return generationConfig
        ? {
              modelId: generationConfig.modelId,
              reasoningEffort: generationConfig.reasoningEffort,
              generationConfig
          }
        : null
}

export const resolveAssistantConfigOverride = ({
    config,
    sharedModels,
    availableModels,
    fallbackModelId
}: {
    config:
        | {
              modelId?: string
              reasoningEffort?: ReasoningEffort
              toolCallLimitFloorOverride?: number
          }
        | null
        | undefined
    sharedModels: readonly SharedModel[]
    availableModels: readonly { id: string }[]
    fallbackModelId?: string | null
}): AssistantConfigOverride | null => {
    if (!config) return null

    const availableIds = new Set(availableModels.map((model) => model.id))
    let resolvedModelId = config.modelId
    const availableFallbackModelId =
        fallbackModelId && availableIds.has(fallbackModelId) ? fallbackModelId : undefined

    if (resolvedModelId && !availableIds.has(resolvedModelId)) {
        const lifecycleResolution = resolveModelReplacement(resolvedModelId, sharedModels, {
            isCandidateAllowed: (candidate) => availableIds.has(candidate.id)
        })

        resolvedModelId =
            lifecycleResolution.resolvedId && availableIds.has(lifecycleResolution.resolvedId)
                ? lifecycleResolution.resolvedId
                : availableFallbackModelId
    }

    const resolvedSharedModel = resolvedModelId
        ? sharedModels.find((model) => model.id === resolvedModelId)
        : undefined
    const resolvedReasoningEffort =
        config.reasoningEffort && resolvedSharedModel
            ? (getReasoningEffortForPlan(resolvedSharedModel, config.reasoningEffort, null) ??
              undefined)
            : config.reasoningEffort
    const toolCallLimitFloorOverride = Number.isFinite(config.toolCallLimitFloorOverride)
        ? Math.min(
              MAX_TOOL_CALL_LIMIT_PER_TURN,
              Math.max(
                  MIN_TOOL_CALL_LIMIT_PER_TURN,
                  Math.round(config.toolCallLimitFloorOverride as number)
              )
          )
        : undefined

    if (!resolvedModelId && !resolvedReasoningEffort && !toolCallLimitFloorOverride) {
        return null
    }

    return {
        ...(resolvedModelId ? { modelIdOverride: resolvedModelId } : {}),
        ...(resolvedReasoningEffort ? { reasoningEffortOverride: resolvedReasoningEffort } : {}),
        ...(toolCallLimitFloorOverride ? { toolCallLimitFloorOverride } : {})
    }
}
