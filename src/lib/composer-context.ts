import {
    DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS,
    DEFAULT_MESSAGE_OVERHEAD_TOKENS,
    type ContextLimitOverride,
    type HostedContextPolicy,
    estimateAnchoredContextTokens,
    resolveContextLimits
} from "@/convex/lib/context_limits"
import type { SharedModel } from "@/convex/lib/models"
import {
    type TokenTally,
    type TokenizerFamily,
    addTallies,
    resolveTokenizerFamily,
    tallyOf,
    tallyText,
    tokenKindForFile,
    weighTally
} from "@/convex/lib/token_kinds"
import type { UIMessage } from "ai"
import type { ChatMessage, UploadedFile } from "./chat-store"
import { estimateTokenCount, getFileTypeInfo } from "./file_constants"
import { estimateImageInputTokens, type ImageDimensions } from "./vision-token-estimate"

const COMPOSER_CONTEXT_WARNING_CONFIDENCE_MULTIPLIER = 1.1

// Reasoning isn't counted: earlier turns' reasoning never reaches the provider. Text is prose
// apart from fenced code, and tool parts are JSON, so each family can weigh them.
const tallyUiMessage = (message: Pick<UIMessage, "parts">) =>
    message.parts.reduce<TokenTally>(
        (tally, part) => {
            if (part.type === "text") return addTallies(tally, tallyText(part.text))
            if (part.type === "file") {
                return addTallies(
                    tally,
                    tallyOf(
                        "fixed",
                        DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS +
                            estimateTokenCount(part.filename ?? "") +
                            estimateTokenCount(part.mediaType ?? "")
                    )
                )
            }
            if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                return addTallies(tally, tallyOf("data", estimateTokenCount(JSON.stringify(part))))
            }
            return tally
        },
        tallyOf("fixed", DEFAULT_MESSAGE_OVERHEAD_TOKENS)
    )

const tallyUploadedFile = (
    file: UploadedFile,
    cachedContentTokens: number | undefined,
    imageDimensions: ImageDimensions | undefined,
    modelId: string | null
) => {
    const tally = tallyOf(
        "fixed",
        DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS +
            estimateTokenCount(file.fileName) +
            estimateTokenCount(file.fileType)
    )
    const fileTypeInfo = getFileTypeInfo(file.fileName, file.fileType)

    // Image bytes are sent as a model image reference, not prompt text. Counting a
    // cached data URL here turns Base64 size into a fictitious text-token estimate.
    if (fileTypeInfo.isImage) {
        tally.fixed += estimateImageInputTokens(imageDimensions, modelId ?? undefined)
        return tally
    }

    // The extension says whether the content is code, data or prose.
    const kind = tokenKindForFile(file.fileName, file.fileType)
    if (cachedContentTokens !== undefined) {
        tally[kind] += cachedContentTokens
    } else if (fileTypeInfo.isText) {
        tally[kind] += Math.ceil(file.fileSize / 4)
    }
    return tally
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

export const CONTEXT_RING_VISIBLE_FRACTION = 0.75

export type ContextRingTone = "muted" | "foreground" | "primary" | "warning" | "destructive"
export type ContextRingLevel = { fromPercent: number; tone: ContextRingTone }
export type ContextRingVisibility = "auto" | "always" | "never"

export const CONTEXT_RING_TONES: readonly ContextRingTone[] = [
    "muted",
    "foreground",
    "primary",
    "warning",
    "destructive"
]

/** Each level's tone applies from its percentage up to the next level's. */
export const DEFAULT_CONTEXT_RING_LEVELS: readonly ContextRingLevel[] = [
    { fromPercent: 0, tone: "muted" },
    { fromPercent: 90, tone: "warning" },
    { fromPercent: 100, tone: "destructive" }
]

export const resolveContextRingTone = (
    percent: number,
    levels: readonly ContextRingLevel[] = DEFAULT_CONTEXT_RING_LEVELS
): ContextRingTone => {
    let tone: ContextRingTone = "muted"
    let reached = Number.NEGATIVE_INFINITY
    for (const level of levels) {
        if (percent >= level.fromPercent && level.fromPercent >= reached) {
            tone = level.tone
            reached = level.fromPercent
        }
    }
    return tone
}

/**
 * Quiet until the context nears its limit; the nerd footer modes keep it on for the numbers.
 * The model chip's key hint already covers the request when it shows, so the two never stack.
 * Dev mode can force it either way.
 */
export const shouldShowContextRing = ({
    fraction,
    hasByokHint,
    nerdMode,
    isNewChat = false,
    visibility = "auto",
    showFromPercent
}: {
    fraction: number | null
    hasByokHint: boolean
    nerdMode: boolean
    isNewChat?: boolean
    visibility?: ContextRingVisibility
    showFromPercent?: number | null
}) => {
    if (fraction === null || visibility === "never") return false
    if (visibility === "always") return true
    if (hasByokHint) return false
    if (nerdMode && !isNewChat) return true
    const threshold = showFromPercent ?? CONTEXT_RING_VISIBLE_FRACTION * 100
    return fraction * 100 >= threshold
}

/**
 * How full the limit the next send answers to is. Hosted requests stop at the hosted cap; once
 * the request can run on the user's own key, only the model's window can stop it.
 */
export const resolveContextRing = (
    usage: ComposerContextUsage | null | undefined,
    runsOnOwnKey: boolean
) => {
    if (!usage) return null
    const limitTokens = runsOnOwnKey ? usage.modelInputLimit : usage.hostedInputLimit
    if (limitTokens <= 0) return null
    return {
        usedTokens: usage.usedTokens,
        limitTokens,
        limitKind: runsOnOwnKey ? ("model" as const) : ("hosted" as const),
        fraction: usage.usedTokens / limitTokens
    }
}

export type ComposerContextUsage = {
    draftTokens: number
    /** The thread plus the draft, as the next request would carry them. */
    usedTokens: number
    hostedInputLimit: number
    modelInputLimit: number
    /** How the count was made, for dev diagnostics. */
    family: TokenizerFamily
    anchor: {
        modelId: string
        family: TokenizerFamily
        /** The provider's count, in the anchor model's own units. */
        realTokens: number
        /** The same count in the selected model's units. */
        tokens: number
        tailTokens: number
    } | null
}

/**
 * The thread's share of the next request. It only changes when the thread, model or limits do,
 * so callers can keep it apart from the draft, which changes on every keystroke.
 */
export type ComposerThreadContext = Omit<ComposerContextUsage, "draftTokens" | "usedTokens"> & {
    threadTokens: number
}

export function estimateComposerThreadContext({
    model,
    messages,
    hostedContextPolicy,
    providerModelId,
    contextOverride
}: {
    model?: SharedModel
    messages: readonly UIMessage[]
    hostedContextPolicy?: HostedContextPolicy
    /** A custom model's id at its provider (e.g. anthropic/claude-fable-5), naming its tokenizer. */
    providerModelId?: string
    /** Dev limit overrides, the same ones the next send carries to the server. */
    contextOverride?: ContextLimitOverride
}): ComposerThreadContext | null {
    if (!model || model.mode === "image") return null
    const { hostedInputLimit, modelInputLimit } = resolveContextLimits(
        model,
        contextOverride,
        hostedContextPolicy
    )
    const family = resolveTokenizerFamily(model.id, providerModelId, ...model.adapters)
    const estimateMessage = (message: Pick<UIMessage, "parts">) =>
        weighTally(tallyUiMessage(message), family)
    // Anchored on the provider's real count when the thread has one, converted if it came from
    // another tokenizer family. The server also adds any system-prompt change since then, which
    // the composer can't see.
    const anchored = estimateAnchoredContextTokens({
        messages: messages as readonly ChatMessage[],
        family,
        estimateMessage
    })

    return {
        threadTokens: anchored
            ? anchored.anchorTokens + anchored.tailTokens
            : messages.reduce((total, message) => total + estimateMessage(message), 0),
        hostedInputLimit,
        modelInputLimit,
        family,
        anchor: anchored
            ? {
                  modelId: anchored.anchorModelId,
                  family: anchored.anchorFamily,
                  realTokens: anchored.realAnchorTokens,
                  tokens: anchored.anchorTokens,
                  tailTokens: anchored.tailTokens
              }
            : null
    }
}

/** The draft's share: cheap enough to run on every keystroke (well under 1ms for 20k chars). */
export const estimateComposerDraftTokens = ({
    family,
    modelId,
    text,
    attachments,
    tokenCounts,
    imageDimensions
}: {
    family: TokenizerFamily
    modelId: string | null
    text: string
    attachments: readonly UploadedFile[]
    tokenCounts: Record<string, number>
    imageDimensions: Record<string, ImageDimensions>
}) =>
    weighTally(
        attachments.reduce(
            (tally, file) =>
                addTallies(
                    tally,
                    tallyUploadedFile(
                        file,
                        tokenCounts[file.key],
                        imageDimensions[file.key],
                        modelId
                    )
                ),
            addTallies(tallyOf("fixed", DEFAULT_MESSAGE_OVERHEAD_TOKENS), tallyText(text))
        ),
        family
    )

export const combineComposerContextUsage = (
    thread: ComposerThreadContext | null,
    draftTokens: number
): ComposerContextUsage | null => {
    if (!thread) return null
    const { threadTokens, ...rest } = thread
    return { ...rest, draftTokens, usedTokens: threadTokens + draftTokens }
}

export function estimateComposerContextUsage({
    model,
    modelId,
    text,
    attachments,
    tokenCounts,
    imageDimensions,
    messages,
    hostedContextPolicy,
    providerModelId,
    contextOverride
}: {
    hostedContextPolicy?: HostedContextPolicy
    model?: SharedModel
    modelId: string | null
    providerModelId?: string
    contextOverride?: ContextLimitOverride
    text: string
    attachments: readonly UploadedFile[]
    tokenCounts: Record<string, number>
    imageDimensions: Record<string, ImageDimensions>
    messages: readonly UIMessage[]
}): ComposerContextUsage | null {
    const thread = estimateComposerThreadContext({
        model,
        messages,
        hostedContextPolicy,
        providerModelId,
        contextOverride
    })
    if (!thread) return null
    return combineComposerContextUsage(
        thread,
        estimateComposerDraftTokens({
            family: thread.family,
            modelId,
            text,
            attachments,
            tokenCounts,
            imageDimensions
        })
    )
}

export function predictComposerContextRouting({
    model,
    usage,
    openRouterByokEnabled
}: {
    model?: SharedModel
    usage: ComposerContextUsage | null
    openRouterByokEnabled: boolean
}) {
    if (!model || !usage || !model.adapters.some((adapter) => adapter.startsWith("openrouter:")))
        return null
    const { draftTokens, hostedInputLimit, modelInputLimit } = usage
    const prospectiveTokens = usage.usedTokens
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
