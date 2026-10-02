import type { UploadedFile } from "./chat-store"
import {
    getThreadDraftKey,
    clearThreadDraft,
    loadThreadDraft,
    saveThreadDraft,
    type ThreadDraftScope
} from "./thread-drafts"
import type { ImageDimensions } from "./vision-token-estimate"
import { createStore } from "zustand/vanilla"
import type { SubmissionResult } from "./chat-submission"

type SubmissionDraft = { text: string; attachments: UploadedFile[] }
const mergeDrafts = (sent: SubmissionDraft | null, current: SubmissionDraft): SubmissionDraft =>
    sent
        ? {
              text: [sent.text, current.text].filter(Boolean).join("\n\n"),
              attachments: [
                  ...sent.attachments,
                  ...current.attachments.filter(
                      (file) => !sent.attachments.some((previous) => previous.key === file.key)
                  )
              ]
          }
        : { text: current.text, attachments: current.attachments }

export type AttachmentJob = {
    id: string
    file: File
    displayName: string
    tileKind: "attachment" | "large-paste"
    source: "upload" | "document" | "pasted-text"
    content?: string
    progress: number
    status: "preparing" | "uploading" | "success" | "ready" | "error"
    error?: string
    previewUrl?: string
    controller: AbortController
}

export function createComposerSession(scope?: ThreadDraftScope) {
    const ownerScope = scope ? { ...scope } : undefined
    const draft = scope ? loadThreadDraft(scope) : undefined
    const store = createStore(() => ({
        text: draft?.text ?? "",
        attachments: draft?.attachments ?? ([] as UploadedFile[]),
        jobs: [] as AttachmentJob[],
        contents: {} as Record<string, string>,
        tokenCounts: {} as Record<string, number>,
        imageDimensions: {} as Record<string, ImageDimensions>,
        revision: 0,
        submitting: false,
        pendingSubmission: null as SubmissionDraft | null,
        acquiring: 0,
        submittedKeys: [] as string[],
        requiredTools: [] as import("./tool-abilities").AbilityId[],
        disposed: false
    }))
    if (ownerScope) {
        let timeout: ReturnType<typeof setTimeout> | undefined
        const flush = () => {
            clearTimeout(timeout)
            const state = store.getState()
            if (state.disposed) return
            saveThreadDraft({
                ...ownerScope,
                key: getThreadDraftKey(ownerScope),
                ...mergeDrafts(state.pendingSubmission, state),
                updatedAt: Date.now()
            })
        }
        // Persist changes at their owner, even after its React surface unmounts.
        // No trailing timer can write one chat's draft into another chat.
        const unsubscribe = store.subscribe((state, previous) => {
            if (
                state.text === previous.text &&
                state.attachments === previous.attachments &&
                state.pendingSubmission === previous.pendingSubmission
            )
                return
            clearTimeout(timeout)
            if (state.attachments !== previous.attachments) flush()
            else timeout = setTimeout(flush, 400)
        })
        persistence.set(store, {
            scope: ownerScope,
            flush,
            stop: () => {
                clearTimeout(timeout)
                unsubscribe()
            }
        })
    }
    return store
}

export type ComposerSession = ReturnType<typeof createComposerSession>
const drafts = new Map<string, ComposerSession>()
const persistence = new WeakMap<
    ComposerSession,
    { scope: ThreadDraftScope; flush: () => void; stop: () => void }
>()
const consumers = new WeakMap<ComposerSession, number>()
const promotedSessions = new WeakMap<ComposerSession, ComposerSession>()
const canonicalSession = (session: ComposerSession): ComposerSession => {
    const destination = promotedSessions.get(session)
    return destination ? canonicalSession(destination) : session
}

export function retainComposerSession(session: ComposerSession) {
    session = canonicalSession(session)
    consumers.set(session, (consumers.get(session) ?? 0) + 1)
    const releaseIfIdle = () =>
        queueMicrotask(() => {
            if (
                (consumers.get(canonicalSession(session)) ?? 0) > 0 ||
                session.getState().submitting ||
                session.getState().requiredTools.length > 0 ||
                attachmentsBusy(session)
            )
                return
            flushComposerDraft(session)
            for (const job of session.getState().jobs)
                if (job.previewUrl) URL.revokeObjectURL(job.previewUrl)
            for (const [key, value] of drafts)
                if (value === canonicalSession(session)) drafts.delete(key)
            unsubscribe()
        })
    const unsubscribe = session.subscribe(releaseIfIdle)
    return () => {
        const current = canonicalSession(session)
        consumers.set(current, Math.max(0, (consumers.get(current) ?? 1) - 1))
        flushComposerDraft(session)
        releaseIfIdle()
    }
}

export const flushComposerDraft = (session: ComposerSession) =>
    persistence.get(canonicalSession(session))?.flush()

export function promoteComposerSession(session: ComposerSession, threadId: string, owner: string) {
    const stored = persistence.get(session)
    if (!stored || stored.scope.threadId) return
    clearThreadDraft(stored.scope)
    for (const [key, value] of drafts) if (value === session) drafts.delete(key)
    stored.scope.threadId = threadId
    const key = `${owner}:${getThreadDraftKey(stored.scope)}`
    // The user may already have opened the new thread from the sidebar while
    // admission was pending. Preserve that live store, including its next draft.
    const destination =
        drafts.get(key) ??
        (loadThreadDraft(stored.scope) ? getComposerSession(stored.scope, owner) : undefined)
    if (destination && destination !== session) {
        stored.stop()
        persistence.delete(session)
        const source = session.getState()
        destination.setState((current) => ({
            ...mergeDrafts(source, current),
            jobs: [...source.jobs, ...current.jobs],
            contents: { ...source.contents, ...current.contents },
            tokenCounts: { ...source.tokenCounts, ...current.tokenCounts },
            imageDimensions: { ...source.imageDimensions, ...current.imageDimensions },
            requiredTools: [...new Set([...source.requiredTools, ...current.requiredTools])],
            acquiring: source.acquiring + current.acquiring,
            revision: Math.max(source.revision, current.revision) + 1
        }))
        consumers.set(
            destination,
            (consumers.get(destination) ?? 0) + (consumers.get(session) ?? 0)
        )
        promotedSessions.set(session, destination)
        // Existing React subscriptions still listen to the original store. Mirror
        // the canonical state to them; late upload closures write to it directly.
        const notifySource = session.setState
        session.setState = destination.setState
        session.getState = destination.getState
        session.subscribe = destination.subscribe
        destination.subscribe((state) => notifySource(state, true))
        notifySource(destination.getState(), true)
        flushComposerDraft(destination)
        return
    }
    drafts.set(key, session)
    stored.flush()
}

export function acceptComposerSubmission(session: ComposerSession, files: readonly UploadedFile[]) {
    const keys = new Set(files.map((file) => file.key))
    session.setState((current) => ({
        attachments: current.attachments.filter((file) => !keys.has(file.key)),
        contents: Object.fromEntries(
            Object.entries(current.contents).filter(([key]) => !keys.has(key))
        ),
        tokenCounts: Object.fromEntries(
            Object.entries(current.tokenCounts).filter(([key]) => !keys.has(key))
        ),
        imageDimensions: Object.fromEntries(
            Object.entries(current.imageDimensions).filter(([key]) => !keys.has(key))
        ),
        submitting: false,
        pendingSubmission: null,
        submittedKeys: []
    }))
    flushComposerDraft(session)
}

// Hide sent content immediately; its recovery copy remains in durable draft storage
// until the transport acknowledges persistence. Keep any next draft separate.
export async function submitComposerDraft(
    session: ComposerSession,
    draft: SubmissionDraft,
    owner: string,
    send: (text: string, files: UploadedFile[]) => Promise<SubmissionResult>
): Promise<SubmissionResult> {
    if (session.getState().disposed || session.getState().submitting || attachmentsBusy(session))
        return { accepted: false }
    session.setState({
        text: "",
        attachments: [],
        submitting: true,
        submittedKeys: draft.attachments.map((file) => file.key),
        pendingSubmission: draft
    })
    flushComposerDraft(session)
    let result: SubmissionResult
    try {
        result = await send(draft.text, draft.attachments)
    } catch {
        result = { accepted: false }
    }
    if (session.getState().disposed) return result
    if (result.accepted) {
        acceptComposerSubmission(session, draft.attachments)
        if (result.threadId) promoteComposerSession(session, result.threadId, owner)
    } else {
        session.setState((current) => ({
            ...mergeDrafts(current.pendingSubmission, current),
            pendingSubmission: null,
            submitting: false,
            submittedKeys: []
        }))
        flushComposerDraft(session)
    }
    return result
}

export function getComposerSession(scope: ThreadDraftScope, owner: string) {
    if (typeof window === "undefined") return createComposerSession()
    const key = `${owner}:${getThreadDraftKey(scope)}`
    let session = drafts.get(key)
    if (!session) {
        session = createComposerSession(scope)
        drafts.set(key, session)
    }
    return session
}

export function setComposerText(session: ComposerSession, text: string) {
    session.setState((state) => ({ text, revision: state.revision + 1 }))
}

export function addComposerAttachment(session: ComposerSession, file: UploadedFile) {
    if (session.getState().disposed) return
    session.setState((state) => ({
        attachments: [...state.attachments, file],
        revision: state.revision + 1
    }))
}

export function removeComposerAttachment(session: ComposerSession, key: string) {
    if (session.getState().submittedKeys.includes(key)) return
    session.setState((state) => ({
        attachments: state.attachments.filter((file) => file.key !== key),
        contents: Object.fromEntries(Object.entries(state.contents).filter(([id]) => id !== key)),
        tokenCounts: Object.fromEntries(
            Object.entries(state.tokenCounts).filter(([id]) => id !== key)
        ),
        imageDimensions: Object.fromEntries(
            Object.entries(state.imageDimensions).filter(([id]) => id !== key)
        ),
        revision: state.revision + 1
    }))
}

export const attachmentsBusy = (session: ComposerSession) =>
    session.getState().acquiring > 0 ||
    session.getState().jobs.some((job) => job.status !== "error")

export function cancelAttachmentJob(session: ComposerSession, id: string) {
    const job = session.getState().jobs.find((job) => job.id === id)
    if (!job) return
    job.controller.abort()
    if (job.previewUrl) URL.revokeObjectURL(job.previewUrl)
    session.setState((state) => ({ jobs: state.jobs.filter((job) => job.id !== id) }))
}

export function disposeComposerSession(session: ComposerSession) {
    for (const job of session.getState().jobs) cancelAttachmentJob(session, job.id)
    session.setState({
        disposed: true,
        submitting: false,
        pendingSubmission: null,
        submittedKeys: []
    })
}

export function invalidateComposerDrafts(matches: (scope: ThreadDraftScope) => boolean) {
    // Session keys are retained in closures by active uploads; disposal prevents late commits.
    for (const [key, session] of drafts) {
        const scope = persistence.get(session)?.scope ?? {}
        if (matches(scope)) {
            disposeComposerSession(session)
            drafts.delete(key)
        }
    }
}
