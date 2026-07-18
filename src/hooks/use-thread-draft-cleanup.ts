import { api } from "@/convex/_generated/api"
import {
    acknowledgeDraftAttachmentDelete,
    cascadeDeleteFolderDrafts,
    cascadeDeleteThreadDraft,
    getPendingDraftAttachmentDeletes
} from "@/lib/thread-drafts"
import { useMutation } from "convex/react"
import { useCallback } from "react"

export function useThreadDraftCleanup() {
    const deleteFileMutation = useMutation(api.attachments.deleteFile)

    const deleteQueuedAttachments = useCallback(
        async (keys: readonly string[] = getPendingDraftAttachmentDeletes()) => {
            await Promise.allSettled(
                [...new Set(keys)].map(async (key) => {
                    const result = await deleteFileMutation({ key })
                    if (result.success || result.error === "File not found") {
                        acknowledgeDraftAttachmentDelete(key)
                    }
                })
            )
        },
        [deleteFileMutation]
    )

    return {
        flushPendingDraftAttachments: deleteQueuedAttachments,
        deleteThreadDraft: useCallback(
            (threadId: string) => {
                cascadeDeleteThreadDraft(threadId)
                void deleteQueuedAttachments()
            },
            [deleteQueuedAttachments]
        ),
        deleteFolderDrafts: useCallback(
            (folderId: string, deletedThreadIds: readonly string[] = []) => {
                cascadeDeleteFolderDrafts(folderId, deletedThreadIds)
                void deleteQueuedAttachments()
            },
            [deleteQueuedAttachments]
        )
    }
}
