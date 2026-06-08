import { describe, expect, it, vi } from "vitest"

import { prepareChatAttachmentForUpload, uploadChatAttachment } from "@/lib/chat-attachments"
import { DEFAULT_UPLOAD_POLICY, UPLOAD_POLICY_HEADER } from "@/lib/file_constants"

describe("chat-attachments", () => {
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
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    key: "attachments/user-1/file.txt",
                    fileName: "file.txt",
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
            "https://example.com/upload",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer jwt",
                    [UPLOAD_POLICY_HEADER]: "client-version"
                })
            })
        )
        expect(onPolicyVersionMismatch).toHaveBeenCalledWith("server-version")
    })
})
