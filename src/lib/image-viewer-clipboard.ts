import { toast } from "@/lib/toast"

/** Tiles copy the original prompt; modal buttons trim it and report missing prompts. */
export async function copyViewerPrompt({
    prompt,
    trim,
    reportEmpty,
    onCopied = () => {},
    isCurrent = () => true
}: {
    prompt?: string
    trim: boolean
    reportEmpty: boolean
    onCopied?: () => void
    isCurrent?: () => boolean
}) {
    const text = trim ? prompt?.trim() : prompt
    if (!text) {
        if (reportEmpty) toast.danger("No prompt available to copy")
        return
    }
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        if (isCurrent()) toast.danger("Failed to copy prompt")
        return
    }
    if (!isCurrent()) return
    onCopied()
    toast.success("Prompt copied to clipboard")
}
