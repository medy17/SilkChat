// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
    submitComposerDraft,
    addComposerAttachment,
    flushComposerDraft,
    getComposerSession,
    invalidateComposerDrafts,
    promoteComposerSession,
    removeComposerAttachment,
    retainComposerSession,
    setComposerText
} from "@/lib/composer-session"
import { loadThreadDraft } from "@/lib/thread-drafts"
import { cascadeDeleteThreadDraft } from "@/lib/thread-drafts"
import { enqueueAttachments, type AttachmentQueueOptions } from "@/lib/composer-attachments"
import { DEFAULT_UPLOAD_POLICY } from "@/lib/file_constants"
const file = (key: string) => ({
    key,
    fileName: `${key}.txt`,
    fileType: "text/plain",
    fileSize: 10,
    uploadedAt: 1
})
beforeEach(() => {
    invalidateComposerDrafts(() => true)
    localStorage.clear()
    vi.useFakeTimers()
})
afterEach(() => {
    invalidateComposerDrafts(() => true)
    vi.useRealTimers()
})

it("persists a late attachment only into its original chat", () => {
    const first = getComposerSession({ threadId: "first" }, "user")
    const second = getComposerSession({ threadId: "second" }, "user")
    setComposerText(first, "Original draft")
    setComposerText(second, "New draft")
    addComposerAttachment(first, file("late"))
    flushComposerDraft(second)
    expect(loadThreadDraft({ threadId: "first" })).toMatchObject({
        text: "Original draft",
        attachments: [file("late")]
    })
    expect(second.getState()).toMatchObject({ text: "New draft", attachments: [] })
})

it("clears the composer immediately, then accepts without losing the next draft", async () => {
    const session = getComposerSession({ threadId: "first" }, "user")
    setComposerText(session, "Sent text")
    addComposerAttachment(session, file("sent"))
    let settle!: (value: { accepted: boolean; threadId?: string }) => void
    const sending = submitComposerDraft(
        session,
        { text: "Sent text", attachments: [file("sent")] },
        "user",
        () =>
            new Promise((resolve) => {
                settle = resolve
            })
    )
    expect(session.getState()).toMatchObject({ text: "", attachments: [], submitting: true })
    expect(loadThreadDraft({ threadId: "first" })).toMatchObject({
        text: "Sent text",
        attachments: [file("sent")]
    })
    removeComposerAttachment(session, "sent")
    expect(session.getState().submittedKeys).toEqual(["sent"])
    // Even identical text typed again is a new draft, not the submitted snapshot.
    setComposerText(session, "Sent text")
    addComposerAttachment(session, file("next"))
    settle({ accepted: true })
    await sending
    expect(loadThreadDraft({ threadId: "first" })).toMatchObject({
        text: "Sent text",
        attachments: [file("next")]
    })
})

it.each([false, true])(
    "restores a rejected submission without overwriting new text (throws=%s)",
    async (throws) => {
        const session = getComposerSession({ threadId: "first" }, "user")
        let finish!: () => void
        const sending = submitComposerDraft(
            session,
            { text: "Unsent", attachments: [file("sent")] },
            "user",
            async () => {
                await new Promise<void>((resolve) => {
                    finish = resolve
                })
                if (throws) throw new Error("Offline")
                return { accepted: false }
            }
        )
        setComposerText(session, "Next thought")
        addComposerAttachment(session, file("new"))
        flushComposerDraft(session)
        expect(loadThreadDraft({ threadId: "first" })?.text).toBe("Unsent\n\nNext thought")
        finish()
        await sending
        expect(session.getState()).toMatchObject({
            text: "Unsent\n\nNext thought",
            attachments: [file("sent"), file("new")],
            submitting: false,
            pendingSubmission: null
        })
    }
)

it("promotes an accepted new-chat submission and preserves its next draft", async () => {
    const session = getComposerSession({ folderId: "project" }, "user")
    await submitComposerDraft(session, { text: "Opening", attachments: [] }, "user", async () => {
        setComposerText(session, "Next")
        return { accepted: true, threadId: "created" }
    })
    expect(loadThreadDraft({ folderId: "project" })).toBeUndefined()
    expect(loadThreadDraft({ threadId: "created" })?.text).toBe("Next")
    expect(getComposerSession({ threadId: "created" }, "user")).toBe(session)
})

it("moves an opening draft's remaining work to its accepted thread", () => {
    const session = getComposerSession({ folderId: "project" }, "user")
    setComposerText(session, "Next question")
    promoteComposerSession(session, "created", "user")
    addComposerAttachment(session, file("late"))
    expect(loadThreadDraft({ folderId: "project" })).toBeUndefined()
    expect(getComposerSession({ threadId: "created", folderId: "project" }, "user")).toBe(session)
    expect(loadThreadDraft({ threadId: "created" })).toMatchObject({
        text: "Next question",
        attachments: [file("late")]
    })
})

it("preserves an already open destination and forwards late work from the opening session", async () => {
    const opening = getComposerSession({}, "user")
    const releaseOpening = retainComposerSession(opening)
    const destination = getComposerSession({ threadId: "created" }, "user")
    const releaseDestination = retainComposerSession(destination)
    setComposerText(opening, "Follow-up while waiting")
    const sourceUpdates: string[] = []
    const unsubscribe = opening.subscribe((state) => sourceUpdates.push(state.text))
    setComposerText(destination, "Draft in the saved chat")
    addComposerAttachment(destination, file("destination"))
    promoteComposerSession(opening, "created", "user")
    addComposerAttachment(opening, file("late"))
    expect(getComposerSession({ threadId: "created" }, "user")).toBe(destination)
    expect(destination.getState()).toMatchObject({
        text: "Follow-up while waiting\n\nDraft in the saved chat",
        attachments: [file("destination"), file("late")]
    })
    releaseDestination()
    await vi.runAllTimersAsync()
    // The opening surface still retains the shared draft after promotion.
    expect(getComposerSession({ threadId: "created" }, "user")).toBe(destination)
    setComposerText(opening, "Latest edit")
    setComposerText(destination, "Destination edit")
    expect(sourceUpdates.at(-1)).toBe("Destination edit")
    unsubscribe()
    releaseOpening()
    await vi.runAllTimersAsync()
    expect(loadThreadDraft({})).toBeUndefined()
    expect(getComposerSession({ threadId: "created" }, "user").getState()).toMatchObject({
        text: "Destination edit",
        attachments: [file("destination"), file("late")]
    })
})

it("merges a destination draft that was already released to storage", async () => {
    const opening = getComposerSession({}, "user")
    const destination = getComposerSession({ threadId: "created" }, "user")
    const release = retainComposerSession(destination)
    setComposerText(destination, "Saved destination draft")
    release()
    await vi.runAllTimersAsync()
    promoteComposerSession(opening, "created", "user")
    expect(loadThreadDraft({ threadId: "created" })?.text).toBe("Saved destination draft")
    setComposerText(opening, "Continued")
    flushComposerDraft(opening)
    expect(getComposerSession({ threadId: "created" }, "user").getState().text).toBe("Continued")
})

it("flushes a fast navigation and releases completed sessions without losing their draft", async () => {
    const session = getComposerSession({ threadId: "first" }, "user")
    const release = retainComposerSession(session)
    setComposerText(session, "Just typed")
    release()
    await vi.runAllTimersAsync()
    const restored = getComposerSession({ threadId: "first" }, "user")
    expect(restored).not.toBe(session)
    expect(restored.getState().text).toBe("Just typed")
})

it("a late upload cannot recreate a deleted chat's scoped draft", async () => {
    const session = getComposerSession({ threadId: "deleted" }, "user")
    setComposerText(session, "Draft")
    flushComposerDraft(session)
    let finish!: () => void
    const upload = vi.fn<AttachmentQueueOptions["upload"]>(async (source, _progress, reserve) => {
        reserve("late")
        await new Promise<void>((resolve) => {
            finish = resolve
        })
        return { ...file("late"), file: source }
    })
    const deleteFile = vi.fn(async () => {})
    const done = enqueueAttachments(
        session,
        [{ file: new File(["text"], "late.txt", { type: "text/plain" }) }],
        {
            mode: "compose",
            support: { supportsVision: true, supportsNativePdf: true },
            policy: DEFAULT_UPLOAD_POLICY,
            canReferenceLongTextAttachments: true,
            upload,
            deleteFile,
            enableTools: vi.fn(),
            reportError: vi.fn()
        }
    )
    await vi.waitFor(() => expect(upload).toHaveBeenCalledOnce())
    invalidateComposerDrafts((scope) => scope.threadId === "deleted")
    cascadeDeleteThreadDraft("deleted")
    finish()
    await vi.runAllTimersAsync()
    await done
    expect(loadThreadDraft({ threadId: "deleted" })).toBeUndefined()
    expect(session.getState().attachments).toEqual([])
    expect(deleteFile).toHaveBeenCalledWith("late")
})
