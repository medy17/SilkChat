import { toast } from "sonner"
import { getGeneratedImageDirectUrl } from "@/lib/generated-image-urls"
import { copyImageUrlToClipboard } from "@/lib/utils"

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
        if (reportEmpty) toast.error("No prompt available to copy")
        return
    }
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        if (isCurrent()) toast.error("Failed to copy prompt")
        return
    }
    if (!isCurrent()) return
    onCopied()
    toast.success("Prompt copied to clipboard")
}

/** Copies the image file itself; shared by the library tile menu and the lightbox. */
export async function copyViewerImage(storageKey: string) {
    const copyPromise = copyImageUrlToClipboard(getGeneratedImageDirectUrl(storageKey))

    toast.promise(copyPromise, {
        loading: "Copying image...",
        success: "Image copied to clipboard",
        error: "Failed to copy image"
    })

    try {
        await copyPromise
    } catch (err) {
        console.error("Failed to copy image:", err)
    }
}
