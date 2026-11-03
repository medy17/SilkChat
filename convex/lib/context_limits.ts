import type { ModelMessage } from "ai"
import type { Infer } from "convex/values"
import type { HTTPAIMessage, Message } from "../schema/message"
import { estimateTokenCount } from "./file_constants"
import type { SharedModel } from "./models"
import {
    type TokenKind,
    type TokenTally,
    type TokenizerFamily,
    addTallies,
    convertTokensBetweenFamilies,
    emptyTally,
    getTaggedTokenKind,
    resolveTokenizerFamily,
    tallyOf,
    tallyText,
    weighTally
} from "./token_kinds"

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

/** The deployment-wide hosted caps. Convex reads them from env; the client gets them from getSharedModels. */
export type HostedContextPolicy = {
    maxInputCostUsd: number
    maxInputTokens: number
    fallbackInputTokens: number
}

export const DEFAULT_HOSTED_CONTEXT_POLICY: HostedContextPolicy = {
    maxInputCostUsd: DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD,
    maxInputTokens: DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS,
    fallbackInputTokens: DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS
}

// `process` doesn't exist in the browser, where this falls back to the defaults.
const readEnv = (name: string) => (typeof process !== "undefined" ? process.env[name] : undefined)

export const getHostedContextPolicy = (): HostedContextPolicy => ({
    maxInputCostUsd: parsePositiveNumber(
        readEnv("HOSTED_CONTEXT_MAX_INPUT_COST_USD"),
        DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD
    ),
    maxInputTokens: Math.floor(
        parsePositiveNumber(
            readEnv("HOSTED_CONTEXT_MAX_INPUT_TOKENS"),
            DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS
        )
    ),
    fallbackInputTokens: Math.floor(
        parsePositiveNumber(
            readEnv("HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS"),
            DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS
        )
    )
})

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
    override?: ContextLimitOverride,
    policy: HostedContextPolicy = getHostedContextPolicy()
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
    const hostedMetadataLimit = configuredHostedLimit ?? policy.maxInputTokens
    const priceDerivedHostedLimit = isPositiveFiniteNumber(model?.inputUsdPer1MTokens)
        ? Math.floor((policy.maxInputCostUsd * 1_000_000) / model.inputUsdPer1MTokens)
        : undefined
    const computedHostedInputLimit = Math.max(
        1_024,
        Math.min(
            computedModelInputLimit,
            hostedMetadataLimit,
            priceDerivedHostedLimit ?? configuredHostedLimit ?? policy.fallbackInputTokens
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
    const currentFamily = resolveTokenizerFamily(currentModelId)
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
            // The thread's size differs under the candidate's tokenizer.
            const candidateTokens = convertTokensBetweenFamilies(
                estimatedTokens,
                currentFamily,
                resolveTokenizerFamily(candidate.id)
            )
            return candidateTokens <= resolveContextLimits(candidate).hostedInputLimit
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

const tallyUnknown = (value: unknown, kind: TokenKind): TokenTally => {
    if (value === null || value === undefined) return emptyTally()
    if (typeof value === "string") return tallyOf(kind, estimateTokenCount(value))
    if (typeof value === "number" || typeof value === "boolean") {
        return tallyOf(kind, estimateTokenCount(String(value)))
    }

    try {
        return tallyOf(kind, estimateTokenCount(JSON.stringify(value)))
    } catch {
        return tallyOf("fixed", DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS)
    }
}

const tallyContentPart = (part: unknown): TokenTally => {
    if (!part || typeof part !== "object") return emptyTally()
    const candidate = part as Record<string, unknown>
    const type = candidate.type

    if (type === "text") {
        return typeof candidate.text === "string"
            ? tallyText(candidate.text, getTaggedTokenKind(candidate))
            : emptyTally()
    }

    // Stored reasoning is plain text without provider signatures, so the SDK drops it from
    // later turns (verified on OpenRouter: identical input with and without it).
    if (type === "reasoning") return emptyTally()

    if (type === "file" || type === "image") {
        return addTallies(
            addTallies(
                tallyOf("fixed", DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS),
                tallyUnknown(candidate.filename, "prose")
            ),
            tallyUnknown(candidate.mediaType ?? candidate.mimeType, "prose")
        )
    }

    // Tool calls and results (and anything else structured) are serialised JSON.
    return tallyUnknown(candidate, "data")
}

const tallyParts = (parts: readonly unknown[]) =>
    parts.reduce<TokenTally>(
        (tally, part) => addTallies(tally, tallyContentPart(part)),
        tallyOf("fixed", DEFAULT_MESSAGE_OVERHEAD_TOKENS)
    )

/** Estimates weigh content by kind for the target model's tokenizer family. */
export const estimateModelMessagesTokens = (
    messages: ModelMessage[],
    family: TokenizerFamily = "o200k"
) =>
    weighTally(
        messages.reduce<TokenTally>((tally, message) => {
            const content = message.content
            return addTallies(
                tally,
                Array.isArray(content)
                    ? tallyParts(content)
                    : addTallies(
                          tallyOf("fixed", DEFAULT_MESSAGE_OVERHEAD_TOKENS),
                          typeof content === "string"
                              ? tallyText(content)
                              : tallyUnknown(content, "data")
                      )
            )
        }, emptyTally()),
        family
    )

export const estimateHttpMessageTokens = (
    message: Infer<typeof HTTPAIMessage>,
    family: TokenizerFamily = "o200k"
) => weighTally(tallyParts(message.parts), family)

export const estimateStoredMessageTokens = (
    message: Pick<Infer<typeof Message>, "parts">,
    family: TokenizerFamily = "o200k"
) => weighTally(tallyParts(message.parts), family)

/**
 * The provider's real input count for a reply's last step, minus reasoning from earlier steps
 * of that turn (sent back within the turn, dropped on the next). `systemTokens` is our estimate
 * of that turn's system prompt, so later turns can add only the change.
 */
export type ContextAnchor = { inputTokens: number; systemTokens?: number }

type AnchorableMessage = {
    role: string
    parts: readonly unknown[]
    metadata?: {
        modelId?: string
        promptTokens?: number
        contextAnchor?: ContextAnchor
    } | null
}

const getPartType = (part: unknown) =>
    part && typeof part === "object" ? (part as { type?: unknown }).type : undefined

// Stored parts use "tool-invocation"; UI parts use "tool-<name>" or "dynamic-tool".
const isToolPart = (part: unknown) => {
    const type = getPartType(part)
    return typeof type === "string" && (type.startsWith("tool-") || type === "dynamic-tool")
}

const resolveContextAnchor = (message: AnchorableMessage): ContextAnchor | null => {
    // The model is what says which tokenizer the count is in.
    if (message.role !== "assistant" || !message.metadata?.modelId) return null
    const anchor = message.metadata.contextAnchor
    if (anchor && isPositiveFiniteNumber(anchor.inputTokens)) return anchor
    // Replies from before anchors were stored: with no tool calls the turn was a single step,
    // so its summed promptTokens is exactly that step's input.
    const promptTokens = message.metadata.promptTokens
    if (isPositiveFiniteNumber(promptTokens) && !message.parts.some(isToolPart)) {
        return { inputTokens: promptTokens }
    }
    return null
}

/**
 * The newest reply carrying a real count, and the parts of it that count doesn't include: its
 * final step (everything after its last tool call). Later messages aren't covered either.
 */
export const findContextAnchor = <M extends AnchorableMessage>(messages: readonly M[]) => {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index]
        const anchor = resolveContextAnchor(message)
        if (!anchor) continue

        let lastToolIndex = -1
        message.parts.forEach((part, partIndex) => {
            if (isToolPart(part)) lastToolIndex = partIndex
        })
        return {
            index,
            anchor,
            modelId: message.metadata?.modelId as string,
            family: resolveTokenizerFamily(message.metadata?.modelId),
            finalStepParts: message.parts.slice(lastToolIndex + 1) as M["parts"]
        }
    }
    return null
}

/** An anchor's counts in the target family's units; exact when the families match. */
export const convertContextAnchor = (
    anchor: ContextAnchor,
    from: TokenizerFamily,
    to: TokenizerFamily
): ContextAnchor => ({
    inputTokens: convertTokensBetweenFamilies(anchor.inputTokens, from, to),
    ...(anchor.systemTokens === undefined
        ? {}
        : { systemTokens: convertTokensBetweenFamilies(anchor.systemTokens, from, to) })
})

/**
 * Context anchored on the newest reply with a real count, from any model: a reply from another
 * tokenizer family is converted. Only what came after that count is estimated. Null when nothing
 * in the history can anchor.
 */
export const estimateAnchoredContextTokens = <M extends AnchorableMessage>({
    messages,
    family,
    estimateMessage
}: {
    /** Chronological, ending with the message about to be sent. */
    messages: readonly M[]
    family: TokenizerFamily
    estimateMessage: (message: { parts: M["parts"] }) => number
}) => {
    const match = findContextAnchor(messages)
    if (!match) return null

    const anchor = convertContextAnchor(match.anchor, match.family, family)
    const tailTokens =
        estimateMessage({ parts: match.finalStepParts }) +
        messages.slice(match.index + 1).reduce((sum, later) => sum + estimateMessage(later), 0)

    return {
        anchorTokens: anchor.inputTokens,
        tailTokens,
        anchorSystemTokens: anchor.systemTokens,
        // Where the count came from, for diagnostics.
        anchorModelId: match.modelId,
        anchorFamily: match.family,
        realAnchorTokens: match.anchor.inputTokens
    }
}
