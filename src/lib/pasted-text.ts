import {
    MAX_INLINE_TEXT_ATTACHMENT_TOKENS,
    PASTED_TEXT_FILE_TOKEN_THRESHOLD,
    estimateTokenCount
} from "@/lib/file_constants"
import type { AbilityId } from "@/lib/tool-abilities"

/** Typed text, a file read in full, or a file code execution fetches by URL. */
export type PastedTextDisposition = "inline" | "attachment" | "url"

export type PastedTextDecision = {
    disposition: PastedTextDisposition
    estimatedTokens: number
}

/** Grades text by size. Attached files take the same grades, apart from staying files. */
export const classifyPastedText = (
    text: string,
    {
        canReferenceLongTextAttachments,
        attachmentQueueBusy = false
    }: {
        canReferenceLongTextAttachments: boolean
        attachmentQueueBusy?: boolean
    }
): PastedTextDecision => {
    const estimatedTokens = estimateTokenCount(text)

    if (attachmentQueueBusy || estimatedTokens <= PASTED_TEXT_FILE_TOKEN_THRESHOLD) {
        return { disposition: "inline", estimatedTokens }
    }

    if (canReferenceLongTextAttachments && estimatedTokens > MAX_INLINE_TEXT_ATTACHMENT_TOKENS) {
        return { disposition: "url", estimatedTokens }
    }

    return { disposition: "attachment", estimatedTokens }
}

export const getPastedTextNames = (index: number) => {
    const safeIndex = Math.max(1, Math.floor(index))
    const displayName = `Pasted Text ${safeIndex}`

    return {
        displayName,
        fileName: `${displayName}.txt`
    }
}

export const getEnabledToolsForPastedText = (
    decision: PastedTextDecision,
    enabledTools: AbilityId[]
): AbilityId[] => {
    if (decision.disposition !== "url" || enabledTools.includes("code_execution")) {
        return enabledTools
    }

    return [...enabledTools, "code_execution"]
}

export const mergePastedTextIntoDraft = (draft: string, pastedText: string) => {
    if (!draft) return pastedText
    if (!pastedText) return draft

    const separator = draft.endsWith("\n") || pastedText.startsWith("\n") ? "" : "\n\n"
    return `${draft}${separator}${pastedText}`
}
