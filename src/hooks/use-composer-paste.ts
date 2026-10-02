import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { UploadedFile } from "@/lib/chat-store"
import { attachmentsBusy, type ComposerSession } from "@/lib/composer-session"
import { classifyPastedText, getPastedTextNames, type PastedTextDecision } from "@/lib/pasted-text"
import { restorePastedAttachment, restorePastedJob } from "@/lib/composer-pasted-text"
import type { useComposerAttachments } from "./use-composer-attachments"

const unlocked = () => false

export function useComposerPaste(
    session: ComposerSession,
    options: {
        mode: "compose" | "edit"
        queue: Pick<ReturnType<typeof useComposerAttachments>, "add" | "remove">
        addFiles: (files: File[]) => Promise<void>
        canReferenceLongTextAttachments: boolean
        enableTools: (decision: PastedTextDecision) => void
        appendText: (text: string) => void
        isLocked?: () => boolean
    }
) {
    const latestOptions = useRef(options)
    latestOptions.current = options
    const counter = useRef(0)
    useEffect(() => {
        counter.current = session
            .getState()
            .attachments.filter((file) => file.source === "pasted-text").length
    }, [session])

    // Return whether the surface should prevent the browser's native paste.
    const paste = useCallback(
        ({ files, text }: { files: File[]; text: string }) => {
            const {
                mode,
                queue,
                addFiles,
                canReferenceLongTextAttachments,
                enableTools,
                isLocked = unlocked
            } = latestOptions.current
            if (isLocked() || session.getState().disposed) return true
            if (files.length) {
                void addFiles(files)
                return true
            }
            const decision = classifyPastedText(text, {
                attachmentQueueBusy: mode === "edit" && attachmentsBusy(session),
                canReferenceLongTextAttachments
            })
            if (decision.disposition === "inline") return false
            enableTools(decision)
            const names = getPastedTextNames(++counter.current)
            void queue.add([
                {
                    file: new File([text], names.fileName, { type: "text/plain" }),
                    pastedText: { content: text, displayName: names.displayName }
                }
            ])
            return true
        },
        [session]
    )

    return {
        paste,
        showUploadingText: (id: string) => {
            const { isLocked = unlocked, appendText } = latestOptions.current
            if (!isLocked()) restorePastedJob(session, id, appendText)
        },
        showUploadedText: async (file: UploadedFile) => {
            const { isLocked = unlocked, appendText, queue } = latestOptions.current
            try {
                await restorePastedAttachment(session, file, appendText, queue.remove, isLocked)
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Could not load pasted text. Try again."
                )
            }
        }
    }
}
