import { LONG_ATTACHMENT_REFERENCE_TOKEN_THRESHOLD, estimateTokenCount } from "@/lib/file_constants"

export { LONG_ATTACHMENT_REFERENCE_TOKEN_THRESHOLD }

export type PastedTextDisposition = "inline" | "url"

export type PastedTextDecision = {
    disposition: PastedTextDisposition
    estimatedTokens: number
}

export const classifyPastedText = (text: string): PastedTextDecision => {
    const estimatedTokens = estimateTokenCount(text)

    if (estimatedTokens <= LONG_ATTACHMENT_REFERENCE_TOKEN_THRESHOLD) {
        return { disposition: "inline", estimatedTokens }
    }

    return { disposition: "url", estimatedTokens }
}

export const getPastedTextNames = (index: number) => {
    const safeIndex = Math.max(1, Math.floor(index))
    const displayName = `Pasted Text ${safeIndex}`

    return {
        displayName,
        fileName: `${displayName}.txt`
    }
}

export const mergePastedTextIntoDraft = (draft: string, pastedText: string) => {
    if (!draft) return pastedText
    if (!pastedText) return draft

    const separator = draft.endsWith("\n") || pastedText.startsWith("\n") ? "" : "\n\n"
    return `${draft}${separator}${pastedText}`
}
