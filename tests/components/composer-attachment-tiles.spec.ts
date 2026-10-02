// @vitest-environment jsdom
import { DraftAttachmentTile } from "@/components/composer/draft-attachment-tile"
import { ExistingAttachmentTile } from "@/components/composer/existing-attachment-tile"
import { UploadingAttachmentTile } from "@/components/composer/uploading-attachment-tile"
import type { UploadedFile } from "@/lib/chat-store"
import type { AttachmentJob } from "@/lib/composer-session"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
})

it("offers paste restoration and optional cancellation without giving document uploads a text action", () => {
    const job: AttachmentJob = {
        id: "paste-job",
        file: new File(["pasted text"], "paste.txt", { type: "text/plain" }),
        displayName: "Pasted Text 1",
        source: "pasted-text",
        tileKind: "large-paste",
        content: "pasted text",
        progress: 0,
        status: "preparing",
        controller: new AbortController()
    }
    const onCancel = vi.fn()
    const onShowText = vi.fn()
    const { rerender } = render(
        createElement(UploadingAttachmentTile, { job, onCancel, onShowText })
    )
    fireEvent.click(screen.getByRole("button", { name: "Show as text" }))
    expect(onShowText).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }))
    expect(onCancel).toHaveBeenCalledOnce()

    rerender(
        createElement(UploadingAttachmentTile, {
            job: { ...job, status: "error", source: "document" },
            onCancel,
            onShowText
        })
    )
    expect(screen.queryByRole("button", { name: "Show as text" })).toBeNull()
    expect(screen.getByRole("button", { name: "Remove failed upload" })).toBeTruthy()

    // Edit batches own their cancellation, so their individual tiles omit it.
    rerender(createElement(UploadingAttachmentTile, { job, onShowText, disabled: true }))
    expect(screen.queryByRole("button", { name: "Cancel upload" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Show as text" }))
    expect(onShowText).toHaveBeenCalledOnce()
})

it("keeps draft preview, text restoration, and removal independent and locks edit actions during save", () => {
    vi.stubEnv("VITE_R2_PUBLIC_BASE_URL", "https://r2.example.com")
    const file: UploadedFile = {
        key: "paste-key",
        fileName: "paste.txt",
        fileType: "text/plain",
        fileSize: 4,
        uploadedAt: 1,
        source: "pasted-text",
        tileKind: "large-paste"
    }
    const onPreview = vi.fn()
    const onShowText = vi.fn()
    const onRemove = vi.fn()
    const props = { file, content: "Text", onPreview, onShowText, onRemove }
    const { rerender } = render(createElement(DraftAttachmentTile, props))
    fireEvent.click(screen.getByRole("button", { name: "paste.txt" }))
    expect(onPreview).toHaveBeenCalledWith({
        fileName: "paste.txt",
        fileType: "text/plain",
        content: "Text",
        url: "https://r2.example.com/paste-key"
    })
    fireEvent.click(screen.getByRole("button", { name: "Show as text" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment" }))
    expect(onPreview).toHaveBeenCalledOnce()
    expect(onShowText).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledOnce()

    rerender(createElement(DraftAttachmentTile, { ...props, disabled: true }))
    fireEvent.click(screen.getByRole("button", { name: "Show as text" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment" }))
    expect(onShowText).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledOnce()
})

it("lets an existing attachment be restored after removal, but prevents changes during save", () => {
    const onToggleRemove = vi.fn()
    const props = {
        part: {
            type: "file" as const,
            filename: "notes.txt",
            mediaType: "text/plain",
            url: "data:text/plain,Notes"
        },
        compact: false,
        onToggleRemove
    }
    const { rerender } = render(createElement(ExistingAttachmentTile, { ...props, removed: false }))
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment from message" }))
    expect(onToggleRemove).toHaveBeenCalledOnce()

    rerender(createElement(ExistingAttachmentTile, { ...props, removed: true }))
    fireEvent.click(screen.getByRole("button", { name: "Restore attachment" }))
    expect(onToggleRemove).toHaveBeenCalledTimes(2)

    rerender(createElement(ExistingAttachmentTile, { ...props, removed: true, disabled: true }))
    fireEvent.click(screen.getByRole("button", { name: "Restore attachment" }))
    expect(onToggleRemove).toHaveBeenCalledTimes(2)
})

it("uses the SVG asset URL for thumbnails instead of cached SVG source text", () => {
    vi.stubEnv("VITE_R2_PUBLIC_BASE_URL", "https://r2.example.com")
    const { container } = render(
        createElement(DraftAttachmentTile, {
            file: {
                key: "diagram.svg",
                fileName: "diagram.svg",
                fileType: "image/svg+xml",
                fileSize: 10,
                uploadedAt: 1
            },
            content: "<svg></svg>",
            onRemove: vi.fn()
        })
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
        "https://r2.example.com/diagram.svg"
    )
})
