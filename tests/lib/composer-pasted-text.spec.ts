// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import {
    createComposerSession,
    disposeComposerSession,
    setComposerText
} from "@/lib/composer-session"
import { restorePastedAttachment, restorePastedJob } from "@/lib/composer-pasted-text"
import { useComposerPaste } from "@/hooks/use-composer-paste"

afterEach(() => vi.unstubAllGlobals())
const pastedFile = {
    key: "paste",
    fileName: "paste.txt",
    fileType: "text/plain",
    fileSize: 1,
    uploadedAt: 1,
    inlineDataUrl: "data:text/plain,hello",
    source: "pasted-text" as const
}

it.each(["submitted", "disposed", "removed", "saving"])(
    "leaves a pending text restoration alone when the attachment is %s",
    async (change) => {
        const session = createComposerSession()
        session.setState({ attachments: [pastedFile] })
        let complete!: (response: Response) => void
        vi.stubGlobal(
            "fetch",
            () =>
                new Promise<Response>((resolve) => {
                    complete = resolve
                })
        )
        const remove = vi.fn(async () => {})
        let saving = false
        const restoring = restorePastedAttachment(
            session,
            pastedFile,
            (text) => setComposerText(session, text),
            remove,
            () => saving
        )
        if (change === "submitted") session.setState({ submittedKeys: [pastedFile.key] })
        if (change === "disposed") disposeComposerSession(session)
        if (change === "removed") session.setState({ attachments: [] })
        if (change === "saving") saving = true
        complete(new Response("restored"))
        await restoring
        expect(session.getState().text).toBe("")
        expect(remove).not.toHaveBeenCalled()
    }
)

it("keeps the attachment on retrieval failure and restores into its owning session on success", async () => {
    const session = createComposerSession()
    session.setState({ attachments: [pastedFile] })
    vi.stubGlobal(
        "fetch",
        vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(new Response("Restored"))
    )
    const remove = async () => {
        session.setState({ attachments: [] })
    }
    const restore = () =>
        restorePastedAttachment(
            session,
            pastedFile,
            (text) => setComposerText(session, text),
            remove,
            () => false
        )
    await expect(restore()).rejects.toThrow("Try again")
    expect(session.getState().attachments).toEqual([pastedFile])
    await restore()
    expect(session.getState()).toMatchObject({ text: "Restored", attachments: [] })
})

it("restoring an uploading paste aborts its shared edit batch", () => {
    const session = createComposerSession()
    const controller = new AbortController()
    session.setState({
        jobs: [
            {
                id: "paste",
                file: new File(["hello"], "paste.txt"),
                displayName: "Paste",
                tileKind: "large-paste",
                source: "pasted-text",
                content: "hello",
                progress: 0,
                status: "uploading",
                controller
            }
        ]
    })
    restorePastedJob(session, "paste", (text) => setComposerText(session, text))
    expect(controller.signal.aborted).toBe(true)
    expect(session.getState()).toMatchObject({ text: "hello", jobs: [] })
})

it("prioritizes clipboard files and leaves text inline while an edit batch is busy", () => {
    const session = createComposerSession()
    session.setState({ acquiring: 1 })
    const addFiles = vi.fn(async () => {})
    const queue = { add: vi.fn(async () => {}), remove: vi.fn(async () => {}) }
    const enableTools = vi.fn()
    const { result } = renderHook(() =>
        useComposerPaste(session, {
            mode: "edit",
            queue,
            addFiles,
            enableTools,
            canReferenceLongTextAttachments: true,
            appendText: vi.fn()
        })
    )
    const files = [new File(["hello"], "file.txt")]
    const text = "word ".repeat(50_000)
    expect(result.current.paste({ files, text })).toBe(true)
    expect(addFiles).toHaveBeenCalledWith(files)
    expect(result.current.paste({ files: [], text })).toBe(false)
    expect(queue.add).not.toHaveBeenCalled()
    expect(enableTools).not.toHaveBeenCalled()
    session.setState({ acquiring: 0 })
    expect(result.current.paste({ files: [], text })).toBe(true)
    expect(queue.add.mock.calls[0]).toBeDefined()
    expect(enableTools).toHaveBeenCalledWith(expect.objectContaining({ disposition: "url" }))
})
