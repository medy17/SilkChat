import type { ModelMessage } from "ai"
import type { Infer } from "convex/values"
import type { HTTPAIMessage, Message } from "../schema/message"
import { estimateTokenCount } from "./file_constants"
import type { SharedModel } from "./models"

export const DEFAULT_MODEL_CONTEXT_LENGTH = 128_000
export const DEFAULT_MAX_OUTPUT_TOKENS = 16_096
export const DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD = 0.75
export const DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS = 32_000
export const DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS = 128_000
export const DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS = 256
export const DEFAULT_MESSAGE_OVERHEAD_TOKENS = 4

type ProviderSource = "internal" | "byok" | "openrouter" | "custom" | "unknown"

export type ContextLimitPolicyModel = Pick<
    SharedModel,
    | "contextLength"
    | "maxTokens"
    | "inputUsdPer1MTokens"
    | "outputUsdPer1MTokens"
    | "hostedContextLength"
>

export type ContextLimits = {
    modelContextLength: number
    maxOutputTokens: number
    safetyMarginTokens: number
    modelInputLimit: number
    hostedInputLimit: number
}

export type ContextLimitViolation = {
    limitType: "hosted" | "model"
    estimatedTokens: number
    limitTokens: number
    modelId: string
    canUseByok: boolean
}

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
    if (!value) return fallback
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getHostedMaxInputCostUsd = () =>
    parsePositiveNumber(
        process.env.HOSTED_CONTEXT_MAX_INPUT_COST_USD,
        DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD
    )

const getHostedFallbackInputTokens = () =>
    Math.floor(
        parsePositiveNumber(
            process.env.HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS,
            DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS
        )
    )

const getHostedMaxInputTokens = () =>
    Math.floor(
        parsePositiveNumber(
            process.env.HOSTED_CONTEXT_MAX_INPUT_TOKENS,
            DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS
        )
    )

const isPositiveFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0

export const resolveContextLimits = (model: ContextLimitPolicyModel | null | undefined) => {
    const modelContextLength = isPositiveFiniteNumber(model?.contextLength)
        ? model.contextLength
        : DEFAULT_MODEL_CONTEXT_LENGTH
    const maxOutputTokens = isPositiveFiniteNumber(model?.maxTokens)
        ? model.maxTokens
        : DEFAULT_MAX_OUTPUT_TOKENS
    const safetyMarginTokens = Math.max(4_096, Math.ceil(modelContextLength * 0.05))
    const modelInputLimit = Math.max(
        1_024,
        modelContextLength - maxOutputTokens - safetyMarginTokens
    )

    const configuredHostedLimit = isPositiveFiniteNumber(model?.hostedContextLength)
        ? model.hostedContextLength
        : undefined
    const hostedMetadataLimit = configuredHostedLimit ?? getHostedMaxInputTokens()
    const priceDerivedHostedLimit = isPositiveFiniteNumber(model?.inputUsdPer1MTokens)
        ? Math.floor((getHostedMaxInputCostUsd() * 1_000_000) / model.inputUsdPer1MTokens)
        : undefined
    const hostedInputLimit = Math.max(
        1_024,
        Math.min(
            modelInputLimit,
            hostedMetadataLimit,
            priceDerivedHostedLimit ?? configuredHostedLimit ?? getHostedFallbackInputTokens()
        )
    )

    return {
        modelContextLength,
        maxOutputTokens,
        safetyMarginTokens,
        modelInputLimit,
        hostedInputLimit
    } satisfies ContextLimits
}

export const getContextLimitViolation = ({
    estimatedTokens,
    limits,
    providerSource,
    modelId
}: {
    estimatedTokens: number
    limits: ContextLimits
    providerSource: ProviderSource
    modelId: string
}): ContextLimitViolation | null => {
    if (estimatedTokens > limits.modelInputLimit) {
        return {
            limitType: "model",
            estimatedTokens,
            limitTokens: limits.modelInputLimit,
            modelId,
            canUseByok: false
        }
    }

    if (
        (providerSource === "internal" || providerSource === "unknown") &&
        estimatedTokens > limits.hostedInputLimit
    ) {
        return {
            limitType: "hosted",
            estimatedTokens,
            limitTokens: limits.hostedInputLimit,
            modelId,
            canUseByok: true
        }
    }

    return null
}

const estimateUnknownTokens = (value: unknown): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === "string") return estimateTokenCount(value)
    if (typeof value === "number" || typeof value === "boolean") {
        return estimateTokenCount(String(value))
    }

    try {
        return estimateTokenCount(JSON.stringify(value))
    } catch {
        return DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS
    }
}

const estimateContentPartTokens = (part: unknown): number => {
    if (!part || typeof part !== "object") return 0
    const candidate = part as Record<string, unknown>
    const type = candidate.type

    if (type === "text") {
        return estimateUnknownTokens(candidate.text)
    }

    if (type === "reasoning") {
        return estimateUnknownTokens(candidate.text ?? candidate.reasoning)
    }

    if (type === "tool-call" || type === "tool-result") {
        return estimateUnknownTokens(candidate)
    }

    if (type === "file" || type === "image") {
        return (
            DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS +
            estimateUnknownTokens(candidate.filename) +
            estimateUnknownTokens(candidate.mediaType ?? candidate.mimeType)
        )
    }

    return estimateUnknownTokens(candidate)
}

export const estimateModelMessagesTokens = (messages: ModelMessage[]) =>
    messages.reduce((total, message) => {
        const content = message.content
        const contentTokens = Array.isArray(content)
            ? content.reduce((sum, part) => sum + estimateContentPartTokens(part), 0)
            : estimateUnknownTokens(content)

        return total + DEFAULT_MESSAGE_OVERHEAD_TOKENS + contentTokens
    }, 0)

export const estimateHttpMessageTokens = (message: Infer<typeof HTTPAIMessage>) => {
    const partTokens = message.parts.reduce((sum, part) => sum + estimateContentPartTokens(part), 0)
    return DEFAULT_MESSAGE_OVERHEAD_TOKENS + partTokens
}

export const estimateStoredMessageTokens = (message: Infer<typeof Message>) => {
    const partTokens = message.parts.reduce((sum, part) => sum + estimateContentPartTokens(part), 0)
    return DEFAULT_MESSAGE_OVERHEAD_TOKENS + partTokens
}
