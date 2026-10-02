import { afterEach, expect, it, vi } from "vitest"
import {
    enqueueAttachments,
    discardEditAttachments,
    type AttachmentQueueOptions
} from "@/lib/composer-attachments"
import {
    createComposerSession,
    disposeComposerSession,
    cancelAttachmentJob
} from "@/lib/composer-session"
import { attachmentsBusy } from "@/lib/composer-session"
import { DEFAULT_UPLOAD_POLICY } from "@/lib/file_constants"
import { convertDocumentToMarkdownFile } from "@/lib/document-conversion"

vi.mock("@/lib/document-conversion", () => ({
    convertDocumentToMarkdownFile: vi.fn(),
    createInlineDocumentDataUrl: (content: string) =>
        `data:text/markdown,${encodeURIComponent(content)}`
}))

const input = (name: string) => ({ file: new File(["some text"], name, { type: "text/plain" }) })
const uploaded = (file: File) => ({
    file,
    key: file.name,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadedAt: 1
})
function options(mode: "compose" | "edit", upload: AttachmentQueueOptions["upload"]) {
    return {
        mode,
        upload,
        policy: DEFAULT_UPLOAD_POLICY,
        support: { supportsVision: true, supportsNativePdf: true },
        canReferenceLongTextAttachments: true,
        deleteFile: vi.fn(async (_key: string) => {}),
        enableTools: vi.fn(),
        reportError: vi.fn()
    }
}
afterEach(() => vi.useRealTimers())

it("compose keeps successes when another member fails, with one upload call per valid file", async () => {
    vi.useFakeTimers()
    const session = createComposerSession()
    const upload = vi.fn<AttachmentQueueOptions["upload"]>(async (file, _progress, reserve) => {
        reserve(file.name)
        if (file.name === "bad.txt") throw new Error("Failed upload")
        return uploaded(file)
    })
    const config = options("compose", upload)
    const done = enqueueAttachments(
        session,
        [input("good.txt"), input("bad.txt"), input("unsupported.exe")],
        config
    )
    await vi.runAllTimersAsync()
    await done
    expect(upload).toHaveBeenCalledTimes(2)
    expect(session.getState().attachments.map((file) => file.key)).toEqual(["good.txt"])
    expect(session.getState().jobs).toMatchObject([{ status: "error" }])
    expect(config.deleteFile).not.toHaveBeenCalled()
})

it("edit processes its batch serially and rolls back all reservations on failure", async () => {
    vi.useFakeTimers()
    const session = createComposerSession()
    let finishFirst!: () => void
    const upload = vi.fn<AttachmentQueueOptions["upload"]>(async (file, _progress, reserve) => {
        reserve(file.name)
        if (file.name === "first.txt")
            await new Promise<void>((resolve) => {
                finishFirst = resolve
            })
        else throw new Error("Second file failed")
        return uploaded(file)
    })
    const config = options("edit", upload)
    const done = enqueueAttachments(session, [input("first.txt"), input("second.txt")], config)
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(session.getState().attachments).toEqual([])
    finishFirst()
    await vi.runAllTimersAsync()
    await done
    expect(upload).toHaveBeenCalledTimes(2)
    expect(session.getState().attachments).toEqual([])
    expect(new Set(config.deleteFile.mock.calls.map(([key]) => key))).toEqual(
        new Set(["first.txt", "second.txt"])
    )
})

it.each(["compose", "edit"] as const)(
    "cleans up an upload completing after %s cancellation",
    async (mode) => {
        vi.useFakeTimers()
        const session = createComposerSession()
        let finish!: () => void
        const upload = vi.fn<AttachmentQueueOptions["upload"]>(async (file, _progress, reserve) => {
            reserve(file.name)
            await new Promise<void>((resolve) => {
                finish = resolve
            })
            return uploaded(file)
        })
        const config = options(mode, upload)
        const done = enqueueAttachments(session, [input("late.txt")], config)
        await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
        if (mode === "compose") cancelAttachmentJob(session, session.getState().jobs[0].id)
        else disposeComposerSession(session)
        finish()
        await vi.runAllTimersAsync()
        await done
        expect(session.getState().attachments).toEqual([])
        expect(session.getState().jobs).toEqual([])
        expect(config.deleteFile.mock.calls).toEqual([["late.txt"]])
    }
)

it("rejects an invalid edit batch without uploading its otherwise valid files", async () => {
    const config = options("edit", vi.fn())
    await enqueueAttachments(createComposerSession(), [input("good.txt"), input("bad.exe")], config)
    expect(config.upload).not.toHaveBeenCalled()
    expect(config.reportError).toHaveBeenCalledOnce()
})

it("a failed edit batch releases controls before its error tiles disappear", async () => {
    vi.useFakeTimers()
    const session = createComposerSession()
    const upload = vi.fn<AttachmentQueueOptions["upload"]>(async (file) => {
        if (file.name === "bad.txt") throw new Error("Failed")
        return uploaded(file)
    })
    const config = options("edit", upload)
    const first = enqueueAttachments(session, [input("bad.txt"), input("unstarted.txt")], config)
    await vi.waitFor(() => expect(config.reportError).toHaveBeenCalled())
    expect(session.getState().jobs).toHaveLength(2)
    expect(attachmentsBusy(session)).toBe(false)
    const next = enqueueAttachments(session, [input("next.txt")], config)
    await vi.runAllTimersAsync()
    await Promise.all([first, next])
    expect(session.getState().attachments.map((file) => file.key)).toEqual(["next.txt"])
})

it("reports validation, conversion failure, and inline ingestion at their actual stages", async () => {
    vi.useFakeTimers()
    const config = { ...options("compose", vi.fn()), onProcessed: vi.fn() }
    vi.mocked(convertDocumentToMarkdownFile).mockRejectedValueOnce(new Error("Bad document"))
    const failed = enqueueAttachments(
        createComposerSession(),
        [input("bad.exe"), input("broken.docx")],
        config
    )
    await vi.runAllTimersAsync()
    await failed
    expect(config.onProcessed.mock.calls.map((call) => call[2])).toEqual([
        "validation",
        "conversion"
    ])
    config.onProcessed.mockClear()
    vi.mocked(convertDocumentToMarkdownFile).mockResolvedValueOnce({
        file: new File(["Converted"], "document.md", { type: "text/markdown" }),
        content: "Converted",
        estimatedTokens: 2,
        sourceFormat: "docx",
        sourceMediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    })
    const complete = enqueueAttachments(createComposerSession(), [input("document.docx")], config)
    await vi.runAllTimersAsync()
    await complete
    expect(config.onProcessed.mock.calls.map((call) => call[2])).toEqual(["inline_ingest"])
    expect(config.upload).not.toHaveBeenCalled()
})

it("discard deletes completed additions, rolls back the active batch, and never starts queued files", async () => {
    vi.useFakeTimers()
    const session = createComposerSession()
    let finish!: () => void
    let activeSignal!: AbortSignal
    const upload = vi.fn<AttachmentQueueOptions["upload"]>(
        async (file, _progress, reserve, signal) => {
            reserve(file.name)
            if (file.name === "in-flight.txt") {
                activeSignal = signal
                await new Promise<void>((resolve) => {
                    finish = resolve
                })
            }
            return uploaded(file)
        }
    )
    const config = options("edit", upload)
    const first = enqueueAttachments(session, [input("previous-batch.txt")], config)
    await vi.runAllTimersAsync()
    await first
    const second = enqueueAttachments(
        session,
        [input("done.txt"), input("in-flight.txt"), input("queued.txt")],
        config
    )
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(3))
    // Discard snapshots the live session, including a batch completed since render.
    await discardEditAttachments(session, config.deleteFile)
    expect(activeSignal.aborted).toBe(true)
    finish() // Simulate an upload response arriving despite the browser abort.
    await vi.runAllTimersAsync()
    await second
    expect(session.getState()).toMatchObject({ disposed: true, attachments: [], jobs: [] })
    expect(upload.mock.calls.map(([file]) => file.name)).toEqual([
        "previous-batch.txt",
        "done.txt",
        "in-flight.txt"
    ])
    expect(config.deleteFile.mock.calls.map(([key]) => key).sort()).toEqual([
        "done.txt",
        "in-flight.txt",
        "previous-batch.txt"
    ])
    expect(config.reportError).not.toHaveBeenCalled()
    await discardEditAttachments(session, config.deleteFile)
    expect(config.deleteFile).toHaveBeenCalledTimes(3)
})

it.each([0, 500])(
    "discard during the completed batch's display delay (%s ms) rolls it back",
    async (elapsed) => {
        vi.useFakeTimers()
        const session = createComposerSession()
        const config = options("edit", async (file, _progress, reserve) => {
            reserve(file.name)
            return uploaded(file)
        })
        const done = enqueueAttachments(session, [input("done.txt")], config)
        await vi.waitFor(() => expect(session.getState().jobs[0]?.status).toBe("success"))
        await vi.advanceTimersByTimeAsync(elapsed)
        await discardEditAttachments(session, config.deleteFile)
        await vi.runAllTimersAsync()
        await done
        expect(session.getState().attachments).toEqual([])
        expect(config.deleteFile.mock.calls).toEqual([["done.txt"]])
    }
)

it("cleans a reservation whose response arrives after the editor was discarded", async () => {
    vi.useFakeTimers()
    const session = createComposerSession()
    let finishReservation!: () => void
    const config = options("edit", async (file, _progress, reserve) => {
        await new Promise<void>((resolve) => {
            finishReservation = resolve
        })
        reserve(file.name)
        return uploaded(file)
    })
    const done = enqueueAttachments(session, [input("late-reservation.txt")], config)
    await vi.waitFor(() => expect(finishReservation).toBeDefined())
    await discardEditAttachments(session, config.deleteFile)
    finishReservation()
    await vi.runAllTimersAsync()
    await done
    expect(session.getState()).toMatchObject({ attachments: [], jobs: [] })
    expect(config.deleteFile.mock.calls).toEqual([["late-reservation.txt"]])
})
