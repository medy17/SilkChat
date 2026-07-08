import { useEffect } from "react"
import { create } from "zustand"

import { type ContextLimitPolicyModel, resolveContextLimits } from "@/convex/lib/context_limits"
import { getActiveDevContextOverride, useAreDevOverridesActive } from "@/lib/dev-overrides"
import { estimateTokenCount, getFileTypeInfo } from "@/lib/file_constants"

/**
 * Read-only diagnostics for the active thread, surfaced in the dev dock. Computed where the
 * messages already live (the chat route) and published into this store so the global dock
 * can render it without re-fetching. Pure `computeThreadStats` keeps the aggregation testable.
 */

export type DiagMessagePart = {
    type: string
    text?: string
    filename?: string
    mediaType?: string
    url?: string
}

export type DiagMessageMetadata = {
    promptTokens?: number
    completionTokens?: number
    estimatedCostUsd?: number
}

export type DiagMessage = {
    role: string
    parts?: readonly DiagMessagePart[]
    metadata?: DiagMessageMetadata
}

export type ThreadAttachmentCounts = {
    total: number
    pdf: number
    textCode: number
    image: number
    other: number
}

export type ThreadTokenStats = {
    messages: number
    userMessages: number
    assistantMessages: number
    canonicalInputTokens: number
    canonicalOutputTokens: number
    canonicalTotalTokens: number
    estimatorInputTokens: number
    estimatorOutputTokens: number
    estimatorTotalTokens: number
    totalCostUsd: number
    attachments: ThreadAttachmentCounts
    /**
     * The most recent assistant turn's canonical prompt tokens (from OpenRouter). This is the
     * real size of the last request's context — it includes the system prompt, which our
     * content-only estimator does not — so it's the best basis for "tokens until limit".
     */
    lastCanonicalPromptTokens: number | null
}

const isNonNegative = (value: number | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0

const messageText = (message: DiagMessage) =>
    (message.parts ?? [])
        .filter((part) => part.type === "text" || part.type === "reasoning")
        .map((part) => part.text ?? "")
        .join("\n")

const bucketForPart = (part: DiagMessagePart): keyof ThreadAttachmentCounts | null => {
    if (part.type !== "file") return null
    const info = getFileTypeInfo(part.filename ?? "attachment", part.mediaType)
    if (info.isPdf) return "pdf"
    if (info.isImage) return "image"
    if (info.isText) return "textCode"
    return "other"
}

export const computeThreadStats = (messages: readonly DiagMessage[]): ThreadTokenStats => {
    const attachments: ThreadAttachmentCounts = {
        total: 0,
        pdf: 0,
        textCode: 0,
        image: 0,
        other: 0
    }

    let userMessages = 0
    let assistantMessages = 0
    let canonicalInputTokens = 0
    let canonicalOutputTokens = 0
    let estimatorInputTokens = 0
    let estimatorOutputTokens = 0
    let totalCostUsd = 0
    let lastCanonicalPromptTokens: number | null = null

    for (const message of messages) {
        const isAssistant = message.role === "assistant"
        const isUser = message.role === "user"
        if (isAssistant) assistantMessages += 1
        if (isUser) userMessages += 1

        for (const part of message.parts ?? []) {
            const bucket = bucketForPart(part)
            if (bucket) {
                attachments.total += 1
                attachments[bucket] += 1
            }
        }

        const estimatedTokens = estimateTokenCount(messageText(message))
        if (isAssistant) {
            estimatorOutputTokens += estimatedTokens
            if (isNonNegative(message.metadata?.promptTokens)) {
                canonicalInputTokens += message.metadata.promptTokens
                lastCanonicalPromptTokens = message.metadata.promptTokens
            }
            if (isNonNegative(message.metadata?.completionTokens)) {
                canonicalOutputTokens += message.metadata.completionTokens
            }
            if (isNonNegative(message.metadata?.estimatedCostUsd)) {
                totalCostUsd += message.metadata.estimatedCostUsd
            }
        } else {
            estimatorInputTokens += estimatedTokens
        }
    }

    return {
        messages: messages.length,
        userMessages,
        assistantMessages,
        canonicalInputTokens,
        canonicalOutputTokens,
        canonicalTotalTokens: canonicalInputTokens + canonicalOutputTokens,
        estimatorInputTokens,
        estimatorOutputTokens,
        estimatorTotalTokens: estimatorInputTokens + estimatorOutputTokens,
        totalCostUsd,
        attachments,
        lastCanonicalPromptTokens
    }
}

export type ThreadPersonaInfo = {
    isPersonaThread: boolean
    name: string | null
    kind: "builtin" | "user" | null
    defaultModelId: string | null
    currentModelId: string | null
    avatarKey: string | null
    id: string | null
    description: string | null
}

export type ThreadContextInfo = {
    hostedInputLimit: number
    tokensUntilHostedLimit: number
    otfOverrideActive: boolean
    /** Which figure drove the "tokens until limit" calc. */
    basis: "canonical" | "estimator"
    /** False when the limit came from the client fallback (no OpenRouter pricing available). */
    hasPricing: boolean
}

export type ThreadDiagnostics = {
    threadId: string | null
    stats: ThreadTokenStats
    persona: ThreadPersonaInfo
    context: ThreadContextInfo | null
}

export const useThreadDiagnosticsStore = create<{
    diagnostics: ThreadDiagnostics | null
    setDiagnostics: (diagnostics: ThreadDiagnostics | null) => void
}>((set) => ({
    diagnostics: null,
    setDiagnostics: (diagnostics) => set({ diagnostics })
}))

/**
 * Compute the active thread's diagnostics and publish them for the dock. Runs only while
 * dev tooling is active; clears the store otherwise. Call once from the thread view (it has
 * the live messages + resolved persona/model).
 */
export const usePublishThreadDiagnostics = (input: {
    threadId: string | null
    messages: readonly DiagMessage[]
    persona: ThreadPersonaInfo
    /** Enriched policy model (with OpenRouter pricing) when available; shared model otherwise. */
    contextModel: ContextLimitPolicyModel | null | undefined
    /** Whether contextModel carries real pricing (i.e. the hosted limit is accurate). */
    hasPricing: boolean
}) => {
    const active = useAreDevOverridesActive()
    const setDiagnostics = useThreadDiagnosticsStore((state) => state.setDiagnostics)
    const { threadId, messages, persona, contextModel, hasPricing } = input

    // Clear on unmount so the dock never shows a thread's stats after leaving its view.
    useEffect(() => () => setDiagnostics(null), [setDiagnostics])

    useEffect(() => {
        if (!active) {
            setDiagnostics(null)
            return
        }

        const stats = computeThreadStats(messages)
        const override = getActiveDevContextOverride()
        const limits = resolveContextLimits(contextModel, override)
        // Prefer the canonical last-turn prompt size (includes the server system prompt) over
        // our content-only estimator when it's available.
        const currentContextTokens = stats.lastCanonicalPromptTokens ?? stats.estimatorTotalTokens
        const context: ThreadContextInfo = {
            hostedInputLimit: limits.hostedInputLimit,
            tokensUntilHostedLimit: limits.hostedInputLimit - currentContextTokens,
            otfOverrideActive: override != null,
            basis: stats.lastCanonicalPromptTokens != null ? "canonical" : "estimator",
            hasPricing
        }

        setDiagnostics({ threadId, stats, persona, context })
    }, [active, threadId, messages, persona, contextModel, hasPricing, setDiagnostics])
}
