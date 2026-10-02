import {
    createInlineIngestedFile,
    finalizeIngestedUpload,
    ingestChatAttachment
} from "./attachment-ingest"
import { getAttachmentValidationError, type AttachmentModelSupport } from "./attachment-support"
import {
    prepareChatAttachmentForUpload,
    readChatAttachmentContent,
    type UploadedFileWithSource
} from "./chat-attachments"
import type { UploadedFile } from "./chat-store"
import {
    addComposerAttachment,
    disposeComposerSession,
    type AttachmentJob,
    type ComposerSession
} from "./composer-session"
import { estimateTokenCount, getFileTypeInfo, type UploadPolicy } from "./file_constants"
import type { PastedTextDecision } from "./pasted-text"

export type AttachmentInput = { file: File; pastedText?: { content: string; displayName: string } }
export type AttachmentQueueOptions = {
    mode: "compose" | "edit"
    support: AttachmentModelSupport
    policy: UploadPolicy
    canReferenceLongTextAttachments: boolean
    upload: (
        file: File,
        progress: (value: number) => void,
        reserved: (key: string) => void,
        signal: AbortSignal
    ) => Promise<UploadedFileWithSource>
    deleteFile: (key: string) => Promise<unknown>
    enableTools: (decision: PastedTextDecision) => void
    reportError: (message: string) => void
    onProcessed?: (
        file: File,
        startedAt: number,
        stage: "validation" | "conversion" | "inline_ingest" | "upload",
        error?: unknown
    ) => void
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function discardEditAttachments<T>(
    session: ComposerSession,
    deleteFile: (key: string) => Promise<T>
) {
    // Read the live store: a batch can finish after the editor's last render.
    const files = session.getState().attachments
    disposeComposerSession(session)
    session.setState({ attachments: [], contents: {}, tokenCounts: {}, imageDimensions: {} })
    const keys = [...new Set(files.filter((file) => !file.inlineDataUrl).map((file) => file.key))]
    return Promise.allSettled(keys.map((key) => deleteFile(key)))
}

export async function enqueueAttachments(
    session: ComposerSession,
    inputs: AttachmentInput[],
    options: AttachmentQueueOptions
) {
    if (!inputs.length || session.getState().disposed) return
    if (options.mode === "edit" && session.getState().jobs.some((job) => job.status !== "error"))
        return
    const errors: string[] = []
    const valid = inputs.filter(({ file }) => {
        const error = getAttachmentValidationError(
            { name: file.name, mimeType: file.type, size: file.size },
            options.support,
            options.policy
        )
        if (error) {
            errors.push(error)
            options.onProcessed?.(file, Date.now(), "validation", new Error(error))
        }
        return !error
    })
    if (errors.length) options.reportError(`File validation failed:\n${errors.join("\n")}`)
    if (!valid.length || (errors.length && options.mode === "edit")) return
    const batchController = new AbortController()
    const jobs = valid.map(
        ({ file, pastedText }): AttachmentJob => ({
            id: crypto.randomUUID(),
            file,
            displayName: pastedText?.displayName ?? file.name,
            tileKind: pastedText ? "large-paste" : "attachment",
            source: pastedText ? "pasted-text" : "upload",
            content: pastedText?.content,
            progress: 0,
            status: "preparing",
            previewUrl: getFileTypeInfo(file.name, file.type).isImage
                ? URL.createObjectURL(file)
                : undefined,
            controller: options.mode === "edit" ? batchController : new AbortController()
        })
    )
    session.setState((state) => ({ jobs: [...state.jobs, ...jobs] }))
    const update = (id: string, patch: Partial<AttachmentJob>) =>
        session.setState((state) => ({
            jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job))
        }))
    const remove = (job: AttachmentJob) => {
        if (job.previewUrl) URL.revokeObjectURL(job.previewUrl)
        session.setState((state) => ({ jobs: state.jobs.filter((item) => item.id !== job.id) }))
    }
    const assertActive = (job: AttachmentJob) => {
        job.controller.signal.throwIfAborted()
        if (session.getState().disposed) throw new DOMException("Session discarded", "AbortError")
    }
    const reservations = new Set<string>()
    const rollback = async (keys: Iterable<string>) => {
        const results = await Promise.allSettled([...keys].map((key) => options.deleteFile(key)))
        if (results.some((result) => result.status === "rejected"))
            options.reportError("Some canceled attachments could not be deleted.")
    }
    const prepare = async (job: AttachmentJob) => {
        assertActive(job)
        const startedAt = Date.now()
        const ingested = await ingestChatAttachment(job.file, options).catch((error) => {
            options.onProcessed?.(job.file, startedAt, "conversion", error)
            throw error
        })
        assertActive(job)
        if (ingested.decision) options.enableTools(ingested.decision)
        update(job.id, {
            displayName: job.source === "pasted-text" ? job.displayName : ingested.displayName,
            tileKind: job.source === "pasted-text" ? "large-paste" : ingested.tileKind,
            source: job.source === "pasted-text" ? "pasted-text" : ingested.source,
            content: job.content ?? ingested.content
        })
        return ingested
    }
    const process = async (job: AttachmentJob, ingested: Awaited<ReturnType<typeof prepare>>) => {
        const startedAt = Date.now()
        let reservedKey: string | undefined
        try {
            assertActive(job)
            let uploaded: UploadedFile
            let content = job.content ?? ingested.content
            if (ingested.delivery === "inline") {
                uploaded = createInlineIngestedFile(ingested)
            } else {
                const file = await prepareChatAttachmentForUpload(ingested.file, options.policy)
                assertActive(job)
                update(job.id, { status: "uploading" })
                const result = await options.upload(
                    file,
                    (progress) => update(job.id, { progress }),
                    (key) => {
                        reservedKey = key
                        reservations.add(key)
                    },
                    job.controller.signal
                )
                assertActive(job)
                uploaded =
                    job.source === "pasted-text"
                        ? {
                              ...result,
                              source: "pasted-text",
                              tileKind: "large-paste",
                              displayName: job.displayName,
                              largePasteContent: job.content
                          }
                        : finalizeIngestedUpload(result, ingested)
                content ??= await readChatAttachmentContent(file)
            }
            assertActive(job)
            if (content !== undefined) {
                const text = content
                session.setState((state) => ({
                    contents: { ...state.contents, [uploaded.key]: text },
                    tokenCounts: {
                        ...state.tokenCounts,
                        ...(!uploaded.fileType.startsWith("image/")
                            ? { [uploaded.key]: estimateTokenCount(text) }
                            : {})
                    }
                }))
                if (uploaded.fileType.startsWith("image/") && typeof Image !== "undefined") {
                    const image = new Image()
                    image.src = text
                    await image.decode().catch(() => undefined)
                    if (image.naturalWidth && image.naturalHeight)
                        session.setState((state) => ({
                            imageDimensions: {
                                ...state.imageDimensions,
                                [uploaded.key]: {
                                    width: image.naturalWidth,
                                    height: image.naturalHeight
                                }
                            }
                        }))
                }
            }
            assertActive(job)
            update(job.id, { progress: 100, status: "success" })
            if (options.mode === "compose") {
                await delay(Math.max(0, 500 - (Date.now() - startedAt)) + 500)
                assertActive(job)
                update(job.id, { status: "ready" })
                await delay(200)
                assertActive(job)
                addComposerAttachment(session, uploaded)
                remove(job)
            }
            options.onProcessed?.(
                job.file,
                startedAt,
                ingested.delivery === "inline" ? "inline_ingest" : "upload"
            )
            return uploaded
        } catch (error) {
            if (
                reservedKey &&
                options.mode === "compose" &&
                (job.controller.signal.aborted || session.getState().disposed)
            )
                await rollback([reservedKey])
            if (!job.controller.signal.aborted && !session.getState().disposed)
                options.onProcessed?.(
                    job.file,
                    startedAt,
                    ingested.delivery === "inline" ? "inline_ingest" : "upload",
                    error
                )
            throw error
        }
    }
    const fail = (job: AttachmentJob, error: unknown) => {
        if (job.controller.signal.aborted || session.getState().disposed) {
            remove(job)
            return
        }
        const message = error instanceof Error ? error.message : "Upload failed"
        update(job.id, { status: "error", error: message })
        options.reportError(message)
    }
    if (options.mode === "edit") {
        const uploaded: UploadedFile[] = []
        let active = jobs[0]
        try {
            for (const job of jobs) {
                active = job
                uploaded.push(await process(job, await prepare(job)))
            }
            await delay(500)
            assertActive(active)
            for (const job of jobs) update(job.id, { status: "ready" })
            await delay(200)
            assertActive(active)
            session.setState((state) => ({
                attachments: [...state.attachments, ...uploaded],
                revision: state.revision + 1
            }))
            jobs.forEach(remove)
        } catch (error) {
            // Keep failed tiles briefly, but release the batch lock immediately.
            for (const job of jobs)
                update(job.id, { status: "error", error: "Upload batch failed" })
            await rollback(reservations)
            fail(active, error)
            if (!batchController.signal.aborted) await delay(2000)
            jobs.forEach(remove)
        }
    } else {
        // Preserve compose's serial document conversion, followed by independent uploads.
        const prepared: { job: AttachmentJob; ingested: Awaited<ReturnType<typeof prepare>> }[] = []
        for (const job of jobs) {
            try {
                prepared.push({ job, ingested: await prepare(job) })
            } catch (error) {
                fail(job, error)
            }
        }
        await Promise.allSettled(
            prepared.map(async ({ job, ingested }) => {
                try {
                    await process(job, ingested)
                } catch (error) {
                    fail(job, error)
                }
            })
        )
    }
}
