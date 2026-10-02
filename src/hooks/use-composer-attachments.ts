import { useCallback, useRef } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useToken } from "./auth-hooks"
import { useUploadPolicy } from "./use-upload-policy"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { uploadChatAttachment } from "@/lib/chat-attachments"
import {
    enqueueAttachments,
    type AttachmentInput,
    type AttachmentQueueOptions
} from "@/lib/composer-attachments"
import { removeComposerAttachment, type ComposerSession } from "@/lib/composer-session"
import { toast } from "sonner"

export function useComposerAttachments(
    session: ComposerSession,
    options: Pick<
        AttachmentQueueOptions,
        "mode" | "support" | "canReferenceLongTextAttachments" | "enableTools" | "onProcessed"
    >
) {
    const { token } = useToken()
    const { policy, policyVersion, invalidateUploadPolicy } = useUploadPolicy()
    const deleteFile = useMutation(api.attachments.deleteFile)
    const optionsRef = useRef(options)
    optionsRef.current = options
    const remove = useCallback(
        async (key: string) => {
            if (session.getState().submittedKeys.includes(key)) return
            const file = session.getState().attachments.find((file) => file.key === key)
            if (!file) return
            removeComposerAttachment(session, key)
            if (file.inlineDataUrl) {
                toast.success("Attachment deleted")
                return
            }
            try {
                const result = await deleteFile({ key })
                if (!result.success && result.error !== "File not found")
                    throw new Error(result.error)
                if (result.success) toast.success("Attachment deleted")
                else toast.info("Attachment was already deleted")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to delete attachment")
            }
        },
        [session, deleteFile]
    )
    const add = useCallback(
        (inputs: AttachmentInput[]) =>
            enqueueAttachments(session, inputs, {
                ...optionsRef.current,
                policy,
                reportError: (message) => toast.error(message),
                deleteFile: async (key) => {
                    const result = await deleteFile({ key })
                    if (!result.success && result.error !== "File not found")
                        throw new Error(result.error)
                    return result
                },
                upload: async (file, onProgress, onReservationCreated, signal) => {
                    const jwt = await resolveJwtToken(token)
                    if (!jwt) throw new Error("Authentication token unavailable")
                    return uploadChatAttachment({
                        file,
                        jwt,
                        uploadUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
                        policyVersion,
                        onPolicyVersionMismatch: invalidateUploadPolicy,
                        onProgress,
                        onReservationCreated,
                        signal
                    })
                }
            }),
        [session, policy, policyVersion, invalidateUploadPolicy, deleteFile, token]
    )
    return { add, remove, policy }
}
