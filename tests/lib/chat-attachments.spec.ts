import { describe, expect, it, vi } from "vitest"

import {
    imageNeedsPreparation,
    prepareChatAttachmentForUpload,
    uploadChatAttachment
} from "@/lib/chat-attachments"
import { DEFAULT_UPLOAD_POLICY, UPLOAD_POLICY_HEADER } from "@/lib/file_constants"

describe("chat-attachments", () => {
    it("rejects attachments above the input limit before attempting image compression", async () => {
        const file = new File([new Uint8Array(16)], "large.png", { type: "image/png" })

        await expect(
            prepareChatAttachmentForUpload(file, {
                ...DEFAULT_UPLOAD_POLICY,
                maxFileSize: 15,
                maxImageFileSize: 5
            })
        ).rejects.toThrow("large.png: File size exceeds")
    })

    it("prepares images based on dimensions or encoded size", () => {
        const limits = { maxFileSize: 5, maxDimension: 2048 }

        expect(imageNeedsPreparation({ fileSize: 5, width: 2048, height: 1200, ...limits })).toBe(
            false
        )
        expect(imageNeedsPreparation({ fileSize: 5, width: 4096, height: 1200, ...limits })).toBe(
            true
        )
        expect(imageNeedsPreparation({ fileSize: 6, width: 1024, height: 1024, ...limits })).toBe(
            true
        )
    })

    it("uses upload policy token limits while preparing text attachments", async () => {
        const file = new File(["a".repeat(20)], "notes.txt", { type: "text/plain" })

        await expect(
            prepareChatAttachmentForUpload(file, {
                ...DEFAULT_UPLOAD_POLICY,
                maxTokensPerFile: 2
            })
        ).rejects.toThrow("notes.txt: File exceeds 2 token limit")
    })

    it("sends the cached policy version and reports server version changes", async () => {
        const onPolicyVersionMismatch = vi.fn()
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        key: "attachments/user-1/file.txt",
                        uploadUrl: "https://bucket.r2.cloudflarestorage.com/file.txt?signed=true",
                        headers: {
                            "Content-Type": "text/plain",
                            "If-None-Match": "*"
                        },
                        fileType: "text/plain"
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            [UPLOAD_POLICY_HEADER]: "server-version"
                        }
                    }
                )
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        key: "attachments/user-1/file.txt",
                        fileType: "text/plain",
                        fileSize: 4,
                        uploadedAt: 1
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            [UPLOAD_POLICY_HEADER]: "server-version"
                        }
                    }
                )
            )
        vi.stubGlobal("fetch", fetchMock)

        await expect(
            uploadChatAttachment({
                file: new File(["test"], "file.txt", { type: "text/plain" }),
                jwt: "jwt",
                uploadUrl: "https://example.com/upload",
                policyVersion: "client-version",
                onPolicyVersionMismatch
            })
        ).resolves.toMatchObject({
            key: "attachments/user-1/file.txt",
            fileName: "file.txt"
        })

        expect(fetchMock).toHaveBeenCalledWith(
            "https://example.com/upload/create",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer jwt",
                    [UPLOAD_POLICY_HEADER]: "client-version"
                })
            })
        )
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "https://bucket.r2.cloudflarestorage.com/file.txt?signed=true",
            expect.objectContaining({
                method: "PUT",
                headers: {
                    "Content-Type": "text/plain",
                    "If-None-Match": "*"
                }
            })
        )
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "https://example.com/upload/complete",
            expect.objectContaining({
                body: JSON.stringify({ key: "attachments/user-1/file.txt" })
            })
        )
        expect(onPolicyVersionMismatch).toHaveBeenCalledTimes(2)
        expect(onPolicyVersionMismatch).toHaveBeenCalledWith("server-version")
    })
})
