import type { UploadedFile } from "./chat-store"
import { readPastedAttachment } from "./composer-message"
import {
    cancelAttachmentJob,
    retainComposerSession,
    type ComposerSession
} from "./composer-session"

export function readComposerClipboard(data: DataTransfer | null) {
    return {
        files: Array.from(data?.items ?? [])
            .filter((item) => item.kind === "file")
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null),
        text: data?.getData("text/plain") ?? ""
    }
}

export function restorePastedJob(
    session: ComposerSession,
    id: string,
    append: (text: string) => void
) {
    const job = session.getState().jobs.find((job) => job.id === id)
    if (session.getState().disposed || job?.source !== "pasted-text" || !job.content) return
    cancelAttachmentJob(session, id)
    append(job.content)
}

export async function restorePastedAttachment(
    session: ComposerSession,
    file: UploadedFile,
    append: (text: string) => void,
    remove: (key: string) => Promise<void>,
    isLocked: () => boolean
) {
    if (isLocked() || session.getState().disposed) return
    const release = retainComposerSession(session)
    try {
        const text = await readPastedAttachment(file)
        const state = session.getState()
        if (
            isLocked() ||
            state.disposed ||
            state.submittedKeys.includes(file.key) ||
            !state.attachments.some((item) => item.key === file.key)
        )
            return
        append(text)
        await remove(file.key)
    } finally {
        release()
    }
}
