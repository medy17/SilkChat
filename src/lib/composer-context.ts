import type { SharedModel } from "@/convex/lib/models"
import type { UIMessage } from "ai"
import type { UploadedFile } from "./chat-store"
import { estimateTokenCount, getFileTypeInfo } from "./file_constants"
import { estimateImageInputTokens, type ImageDimensions } from "./vision-token-estimate"

const DEFAULT_MODEL_CONTEXT_LENGTH = 128_000
const MAX_OUTPUT_CONTEXT_FRACTION = 0.25
const MAX_OUTPUT_TOKENS_CAP = 64_000
const DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD = 0.75
const DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS = 32_000
const DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS = 128_000
const DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS = 256
const DEFAULT_MESSAGE_OVERHEAD_TOKENS = 4
const COMPOSER_CONTEXT_WARNING_CONFIDENCE_MULTIPLIER = 1.1

const isPositiveFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0

const resolveComposerContextLimits = (model: SharedModel | undefined) => {
    const modelContextLength = isPositiveFiniteNumber(model?.contextLength)
        ? model.contextLength
        : DEFAULT_MODEL_CONTEXT_LENGTH
    const outputPolicyLimit = Math.min(
        Math.floor(modelContextLength * MAX_OUTPUT_CONTEXT_FRACTION),
        MAX_OUTPUT_TOKENS_CAP
    )
    const maxOutputTokens = isPositiveFiniteNumber(model?.maxTokens)
        ? Math.min(model.maxTokens, outputPolicyLimit)
        : outputPolicyLimit
    const safetyMarginTokens = Math.max(4_096, Math.ceil(modelContextLength * 0.05))
    const modelInputLimit = Math.max(
        1_024,
        modelContextLength - maxOutputTokens - safetyMarginTokens
    )
    const configuredHostedLimit = isPositiveFiniteNumber(model?.hostedContextLength)
        ? model.hostedContextLength
        : undefined
    const hostedMetadataLimit = configuredHostedLimit ?? DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS
    const priceDerivedHostedLimit = isPositiveFiniteNumber(model?.inputUsdPer1MTokens)
        ? Math.floor(
              (DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD * 1_000_000) / model.inputUsdPer1MTokens
          )
        : undefined
    const hostedInputLimit = Math.max(
        1_024,
        Math.min(
            modelInputLimit,
            hostedMetadataLimit,
            priceDerivedHostedLimit ??
                configuredHostedLimit ??
                DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS
        )
    )

    return { modelInputLimit, hostedInputLimit }
}

const estimateUiMessageTokens = (message: UIMessage) =>
    message.parts.reduce((total, part) => {
        if (part.type === "text") return total + estimateTokenCount(part.text)
        if (part.type === "reasoning") return total + estimateTokenCount(part.text ?? "")
        if (part.type === "file") {
            return (
                total +
                DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS +
                estimateTokenCount(part.filename ?? "") +
                estimateTokenCount(part.mediaType ?? "")
            )
        }
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            return total + estimateTokenCount(JSON.stringify(part))
        }
        return total
    }, DEFAULT_MESSAGE_OVERHEAD_TOKENS)

const estimateUploadedFileTokens = (
    file: UploadedFile,
    cachedContentTokens: number | undefined,
    imageDimensions: ImageDimensions | undefined,
    modelId: string | null
) => {
    const baseTokens =
        DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS +
        estimateTokenCount(file.fileName) +
        estimateTokenCount(file.fileType)
    const fileTypeInfo = getFileTypeInfo(file.fileName, file.fileType)

    // Image bytes are sent as a model image reference, not prompt text. Counting a
    // cached data URL here turns Base64 size into a fictitious text-token estimate.
    if (fileTypeInfo.isImage) {
        return baseTokens + estimateImageInputTokens(imageDimensions, modelId ?? undefined)
    }

    if (cachedContentTokens !== undefined) {
        return baseTokens + cachedContentTokens
    }

    if (fileTypeInfo.isText) {
        return baseTokens + Math.ceil(file.fileSize / 4)
    }

    return baseTokens
}

/**
 * Decide whether to surface the model-selector context hint for an approaching
 * overage. We only nudge about hosted/BYOK once the user's OpenRouter key is set
 * up — then the hint reassures them the long request will run on their key. With
 * no key we stay quiet and let the send fail with the actionable rejection
 * instead of pre-warning about a BYOK setup they haven't done. The model-limit
 * case is BYOK-independent (no key can fix it), so it always shows.
 */
export const resolveByokContextHint = (
    routing: { exceedsModelLimit: boolean; openRouterByokEnabled: boolean } | null
): { tooltip: string; ariaLabel: string } | undefined => {
    if (!routing) return undefined
    if (routing.exceedsModelLimit) {
        return {
            tooltip:
                "This request may exceed the selected model's context limit. Shorten it or start a new chat.",
            ariaLabel: "May exceed the model's context limit"
        }
    }
    if (routing.openRouterByokEnabled) {
        return {
            tooltip: "This request exceeds hosted limits and will run on your OpenRouter key.",
            ariaLabel: "Will use your OpenRouter key"
        }
    }
    return undefined
}

export function predictComposerContextRouting({
    model,
    modelId,
    text,
    attachments,
    tokenCounts,
    imageDimensions,
    messages,
    openRouterByokEnabled
}: {
    model?: SharedModel
    modelId: string | null
    text: string
    attachments: readonly UploadedFile[]
    tokenCounts: Record<string, number>
    imageDimensions: Record<string, ImageDimensions>
    messages: readonly UIMessage[]
    openRouterByokEnabled: boolean
}) {
    if (
        !model ||
        model.mode === "image" ||
        !model.adapters.some((adapter) => adapter.startsWith("openrouter:"))
    )
        return null
    const { hostedInputLimit, modelInputLimit } = resolveComposerContextLimits(model)
    const attachmentTokens = attachments.reduce((total, file) => {
        return (
            total +
            estimateUploadedFileTokens(
                file,
                tokenCounts[file.key],
                imageDimensions[file.key],
                modelId
            )
        )
    }, 0)
    const draftTokens =
        DEFAULT_MESSAGE_OVERHEAD_TOKENS + estimateTokenCount(text) + attachmentTokens
    const threadTokens = messages.reduce(
        (total, message) => total + estimateUiMessageTokens(message),
        0
    )
    const prospectiveTokens = threadTokens + draftTokens
    const composerWarningThreshold =
        hostedInputLimit * COMPOSER_CONTEXT_WARNING_CONFIDENCE_MULTIPLIER

    if (draftTokens > composerWarningThreshold) {
        return {
            reason: "message" as const,
            estimatedTokens: draftTokens,
            limitTokens: hostedInputLimit,
            openRouterByokEnabled,
            exceedsModelLimit: draftTokens > modelInputLimit
        }
    }

    if (prospectiveTokens > composerWarningThreshold) {
        return {
            reason: "thread" as const,
            estimatedTokens: prospectiveTokens,
            limitTokens: hostedInputLimit,
            openRouterByokEnabled,
            exceedsModelLimit: prospectiveTokens > modelInputLimit
        }
    }

    return null
}
