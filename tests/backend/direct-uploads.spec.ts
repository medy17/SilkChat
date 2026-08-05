import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserIdentityMock, accountDeletionBlockerMock, r2Mock } = vi.hoisted(() => ({
    getUserIdentityMock: vi.fn(),
    accountDeletionBlockerMock: vi.fn(),
    r2Mock: {
        createDirectUpload: vi.fn(),
        syncMetadata: vi.fn(),
        getMetadata: vi.fn()
    }
}))

vi.mock("../../convex/_generated/server", () => ({
    httpAction: (handler: unknown) => handler
}))

vi.mock("../../convex/attachments", () => ({ r2: r2Mock }))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

vi.mock("../../convex/lib/account_deletion_gate", () => ({
    getAccountDeletionBlockerForAction: accountDeletionBlockerMock
}))

import {
    completeDirectUpload,
    createDirectUpload,
    getDirectUploadPolicy
} from "../../convex/direct_uploads"
import { DEFAULT_UPLOAD_POLICY_VERSION, UPLOAD_POLICY_HEADER } from "../../src/lib/file_constants"

const createHandler = createDirectUpload as unknown as (
    ctx: Record<string, unknown>,
    request: Request
) => Promise<Response>
const completeHandler = completeDirectUpload as unknown as (
    ctx: Record<string, unknown>,
    request: Request
) => Promise<Response>

const request = (path: string, body: Record<string, unknown>) =>
    new Request(`https://example.com${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    })

describe("direct uploads", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getUserIdentityMock.mockResolvedValue({ id: "user-1" })
        accountDeletionBlockerMock.mockResolvedValue(null)
        vi.spyOn(crypto, "randomUUID").mockReturnValue("123e4567-e89b-12d3-a456-426614174000")
    })

    it("rejects disallowed size and type claims before issuing a URL", () => {
        expect(() =>
            getDirectUploadPolicy({
                purpose: "persona-avatar",
                fileName: "avatar.png",
                fileType: "image/png",
                fileSize: 100 * 1024 + 1
            })
        ).toThrow("100KB or smaller")

        expect(() =>
            getDirectUploadPolicy({
                purpose: "persona-doc",
                fileName: "notes.txt",
                fileType: "text/plain",
                fileSize: 4
            })
        ).toThrow("must be markdown")
    })

    it.each([
        ["report.pdf", ""],
        ["download", "application/pdf"],
        ["download", "application/x-pdf"]
    ])("canonicalizes accepted PDF input %s (%s)", (fileName, fileType) => {
        expect(
            getDirectUploadPolicy({
                purpose: "attachment",
                fileName,
                fileType,
                fileSize: 4
            })
        ).toMatchObject({ contentType: "application/pdf" })
    })

    it("uses one canonical signed MIME type for CSV uploads", () => {
        expect(
            getDirectUploadPolicy({
                purpose: "attachment",
                fileName: "report.csv",
                fileType: "text/csv",
                fileSize: 4
            })
        ).toMatchObject({ contentType: "text/plain" })
    })

    it("reserves one server-generated key with exact signed constraints", async () => {
        r2Mock.createDirectUpload.mockResolvedValue({
            key: "attachments/user-1/key-file.txt",
            url: "https://bucket.r2.cloudflarestorage.com/signed",
            headers: { "Content-Type": "text/plain", "If-None-Match": "*" },
            expiresAt: 123
        })

        const response = await createHandler(
            { auth: {} },
            request("/upload/create", {
                purpose: "attachment",
                fileName: "file.txt",
                fileType: "text/plain",
                fileSize: 4
            })
        )

        expect(response.status).toBe(200)
        expect(response.headers.get(UPLOAD_POLICY_HEADER)).toBe(DEFAULT_UPLOAD_POLICY_VERSION)
        expect(r2Mock.createDirectUpload).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                authorId: "user-1",
                key: expect.stringMatching(/^attachments\/user-1\//),
                contentLength: 4,
                contentType: "text/plain",
                ifNoneMatch: "*"
            })
        )
    })

    it("will not finalize another user's prefix", async () => {
        const response = await completeHandler(
            { auth: {} },
            request("/upload/complete", { key: "attachments/user-2/file.txt" })
        )

        expect(response.status).toBe(403)
        expect(r2Mock.syncMetadata).not.toHaveBeenCalled()
    })

    it("finalizes through HEAD-backed metadata verification", async () => {
        r2Mock.getMetadata.mockResolvedValue({
            authorId: "user-1",
            uploadStatus: "ready",
            contentType: "text/plain",
            size: 4
        })

        const response = await completeHandler(
            { auth: {} },
            request("/upload/complete", { key: "attachments/user-1/file.txt" })
        )

        expect(response.status).toBe(200)
        expect(r2Mock.syncMetadata).toHaveBeenCalledWith(
            expect.anything(),
            "attachments/user-1/file.txt",
            { authorId: "user-1", requireReservation: true }
        )
        await expect(response.json()).resolves.toMatchObject({
            key: "attachments/user-1/file.txt",
            fileSize: 4,
            fileType: "text/plain"
        })
    })
})
