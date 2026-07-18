// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"

import type { UploadedFile } from "@/lib/chat-store"
import {
    cascadeDeleteFolderDrafts,
    cascadeDeleteThreadDraft,
    clearThreadDraft,
    getPendingDraftAttachmentDeletes,
    getThreadDraftKey,
    loadThreadDraft,
    saveThreadDraft
} from "@/lib/thread-drafts"

const attachment = (key: string): UploadedFile => ({
    key,
    fileName: `${key}.txt`,
    fileType: "text/plain",
    fileSize: 100,
    uploadedAt: 1
})

describe("thread drafts", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it("keeps text and attachments isolated per thread", () => {
        const firstScope = { threadId: "thread-1", folderId: "folder-1" }
        const secondScope = { threadId: "thread-2", folderId: "folder-1" }

        saveThreadDraft({
            ...firstScope,
            key: getThreadDraftKey(firstScope),
            text: "First draft",
            attachments: [attachment("file-1")],
            updatedAt: 10
        })
        saveThreadDraft({
            ...secondScope,
            key: getThreadDraftKey(secondScope),
            text: "Second draft",
            attachments: [attachment("file-2")],
            updatedAt: 20
        })

        expect(loadThreadDraft(firstScope)).toMatchObject({
            text: "First draft",
            attachments: [{ key: "file-1" }]
        })
        expect(loadThreadDraft(secondScope)).toMatchObject({
            text: "Second draft",
            attachments: [{ key: "file-2" }]
        })
    })

    it("persists pasted attachments without retaining their large source text", () => {
        const scope = { threadId: "thread-1" }
        saveThreadDraft({
            ...scope,
            key: getThreadDraftKey(scope),
            text: "",
            attachments: [
                {
                    ...attachment("pasted-file"),
                    source: "pasted-text",
                    pastedText: "large source".repeat(10_000)
                }
            ],
            updatedAt: 10
        })

        expect(loadThreadDraft(scope)?.attachments[0]).toMatchObject({
            key: "pasted-file",
            source: "pasted-text"
        })
        expect(loadThreadDraft(scope)?.attachments[0]).not.toHaveProperty("pastedText")
    })

    it("clears a submitted draft without scheduling its message attachments for deletion", () => {
        const scope = { threadId: "thread-1" }
        saveThreadDraft({
            ...scope,
            key: getThreadDraftKey(scope),
            text: "Ready to send",
            attachments: [attachment("message-file")],
            updatedAt: 10
        })

        clearThreadDraft(scope)

        expect(loadThreadDraft(scope)).toBeUndefined()
        expect(getPendingDraftAttachmentDeletes()).toEqual([])
    })

    it("cascades folder and thread deletion into a retryable attachment cleanup queue", () => {
        const folderScope = { folderId: "folder-1" }
        const nestedThreadScope = { threadId: "thread-1", folderId: "folder-1" }
        const otherThreadScope = { threadId: "thread-2", folderId: "folder-2" }

        for (const [scope, key] of [
            [folderScope, "folder-file"],
            [nestedThreadScope, "thread-file"],
            [otherThreadScope, "other-file"]
        ] as const) {
            saveThreadDraft({
                ...scope,
                key: getThreadDraftKey(scope),
                text: "",
                attachments: [attachment(key)],
                updatedAt: 10
            })
        }

        expect(cascadeDeleteFolderDrafts("folder-1").sort()).toEqual(
            ["folder-file", "thread-file"].sort()
        )
        expect(loadThreadDraft(otherThreadScope)?.attachments[0]?.key).toBe("other-file")
        expect(cascadeDeleteThreadDraft("thread-2")).toEqual(["other-file"])
        expect(getPendingDraftAttachmentDeletes().sort()).toEqual(
            ["folder-file", "thread-file", "other-file"].sort()
        )
    })
})
