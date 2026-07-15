import type { ModelMessage } from "ai"
import type { Infer } from "convex/values"
import type { HTTPAIMessage, Message } from "../schema/message"
import { estimateTokenCount } from "./file_constants"
import type { SharedModel } from "./models"

export const DEFAULT_MODEL_CONTEXT_LENGTH = 128_000
export const MAX_OUTPUT_CONTEXT_FRACTION = 0.25
export const MAX_OUTPUT_TOKENS_CAP = 64_000
export const DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD = 0.5
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

/**
 * Dev-only, request-scoped override of the computed input limits. Callers must gate this
 * behind a non-production signal (see DEV_CREDIT_LAB_ENABLED) before passing it in — the
 * function itself just applies whatever it is given.
 */
export type ContextLimitOverride = {
    hostedInputLimit?: number | null
    modelInputLimit?: number | null
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

/** Provider catalogs expose a theoretical ceiling, so keep a practical per-request budget. */
export const resolveMaxOutputTokens = (model: ContextLimitPolicyModel | null | undefined) => {
    const contextLength = isPositiveFiniteNumber(model?.contextLength)
        ? model.contextLength
        : DEFAULT_MODEL_CONTEXT_LENGTH
    const policyLimit = Math.min(
        Math.floor(contextLength * MAX_OUTPUT_CONTEXT_FRACTION),
        MAX_OUTPUT_TOKENS_CAP
    )

    return isPositiveFiniteNumber(model?.maxTokens)
        ? Math.min(model.maxTokens, policyLimit)
        : policyLimit
}

export const resolveContextLimits = (
    model: ContextLimitPolicyModel | null | undefined,
    override?: ContextLimitOverride
) => {
    const modelContextLength = isPositiveFiniteNumber(model?.contextLength)
        ? model.contextLength
        : DEFAULT_MODEL_CONTEXT_LENGTH
    const maxOutputTokens = resolveMaxOutputTokens(model)
    const safetyMarginTokens = Math.max(4_096, Math.ceil(modelContextLength * 0.05))
    const computedModelInputLimit = Math.max(
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
    const computedHostedInputLimit = Math.max(
        1_024,
        Math.min(
            computedModelInputLimit,
            hostedMetadataLimit,
            priceDerivedHostedLimit ?? configuredHostedLimit ?? getHostedFallbackInputTokens()
        )
    )

    // Dev override (already gated by the caller). The model limit is the hard cap, so the
    // hosted limit stays clamped to it even when overridden — raise both to go higher.
    const modelInputLimit = isPositiveFiniteNumber(override?.modelInputLimit)
        ? Math.max(1_024, Math.floor(override.modelInputLimit))
        : computedModelInputLimit
    const hostedInputLimit = Math.min(
        modelInputLimit,
        isPositiveFiniteNumber(override?.hostedInputLimit)
            ? Math.max(1_024, Math.floor(override.hostedInputLimit))
            : computedHostedInputLimit
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

export type SuggestedModel = { id: string; name: string }

/**
 * Modality abilities a replacement model must preserve. Reasoning controls
 * (`reasoning`, `effort_control`) are intentionally excluded — they aren't
 * modalities and requiring them would needlessly drop good cheaper options.
 */
const SUGGESTABLE_MODALITIES = ["vision", "native_pdf", "function_calling"] as const

export type ModelSuggestionCandidate = ContextLimitPolicyModel & {
    id: string
    name: string
    abilities: readonly string[]
    mode?: string
    /** Whether the user has any usable adapter for this model. */
    runnable: boolean
    /** Plan needed to pick the model (`availableToPickFor`, defaulting to pro). */
    requiredPlan: "free" | "pro"
    developer?: string
    releaseOrder?: number
    legacy?: boolean
}

/**
 * Rank a price-sorted alternative to a model that just hit its context limit.
 *
 * Only models that (a) preserve the current model's modalities and (b) fit the
 * hosted window for this thread are eligible — fitting hosted guarantees the
 * retry actually goes through on hosted credits, and since the hosted limit is
 * price-derived it doubles as the "cheap enough" gate.
 *
 * Ordering is "cheapest of latest": the user's provider first, then cheapest
 * input price, then newest generation as a tiebreak between same-priced siblings.
 */
export const computeSuggestedModels = ({
    currentModelId,
    currentModelAbilities,
    currentModelDeveloper,
    estimatedTokens,
    userPlan,
    candidates,
    limit = 3
}: {
    currentModelId: string
    currentModelAbilities: readonly string[]
    currentModelDeveloper?: string
    estimatedTokens: number
    userPlan: "free" | "pro"
    candidates: ModelSuggestionCandidate[]
    limit?: number
}): SuggestedModel[] => {
    const requiredModalities = SUGGESTABLE_MODALITIES.filter((ability) =>
        currentModelAbilities.includes(ability)
    )

    const costKey = (candidate: ModelSuggestionCandidate) => {
        const price = candidate.inputUsdPer1MTokens
        if (typeof price === "number" && Number.isFinite(price) && price >= 0) return price
        // Keep models without known pricing behind models with explicit pricing.
        return 1e9
    }

    return candidates
        .filter((candidate) => {
            if (candidate.id === currentModelId) return false
            if (!candidate.runnable) return false
            if (candidate.legacy) return false
            if (candidate.mode && candidate.mode !== "text") return false
            if (userPlan === "free" && candidate.requiredPlan === "pro") return false
            if (!requiredModalities.every((ability) => candidate.abilities.includes(ability))) {
                return false
            }
            return estimatedTokens <= resolveContextLimits(candidate).hostedInputLimit
        })
        .sort((a, b) => {
            const aSameProvider = a.developer === currentModelDeveloper ? 0 : 1
            const bSameProvider = b.developer === currentModelDeveloper ? 0 : 1
            if (aSameProvider !== bSameProvider) return aSameProvider - bSameProvider

            const aCost = costKey(a)
            const bCost = costKey(b)
            if (aCost !== bCost) return aCost - bCost

            return (b.releaseOrder ?? 0) - (a.releaseOrder ?? 0)
        })
        .slice(0, limit)
        .map((candidate) => ({ id: candidate.id, name: candidate.name }))
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
