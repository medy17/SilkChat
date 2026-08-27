import { S3Client } from "@aws-sdk/client-s3"
import { R2 } from "@convex-dev/r2"
import { describe, expect, it, vi } from "vitest"
import {
    deletePendingMetadata,
    syncMetadata,
    upsertMetadata
} from "../../node_modules/@convex-dev/r2/dist/component/lib.js"

type MetadataRecord = {
    _id: string
    authorId: string
    bucket: string
    key: string
    contentType: string
    size: number
    uploadStatus: "pending" | "ready"
    expectedContentType?: string
    expectedSize?: number
}

type MutationWithHandler = {
    _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>
}

const createMetadataContext = (initial: MetadataRecord) => {
    let metadata: MetadataRecord | null = initial
    const deleteMock = vi.fn(async () => {
        metadata = null
    })
    const patchMock = vi.fn(
        async (_table: string, _id: string, fields: Partial<MetadataRecord>) => {
            if (metadata) metadata = { ...metadata, ...fields }
        }
    )

    return {
        ctx: {
            db: {
                query: () => ({
                    withIndex: () => ({ unique: async () => metadata })
                }),
                delete: deleteMock,
                patch: patchMock,
                insert: vi.fn()
            }
        },
        deleteMock,
        getMetadata: () => metadata
    }
}

const pendingMetadata = (): MetadataRecord => ({
    _id: "metadata-1",
    authorId: "user-1",
    bucket: "uploads",
    key: "attachments/user-1/file.txt",
    contentType: "text/plain",
    size: 4,
    uploadStatus: "pending",
    expectedContentType: "text/plain",
    expectedSize: 4
})

const finalizeArgs = {
    authorId: "user-1",
    bucket: "uploads",
    key: "attachments/user-1/file.txt",
    contentType: "text/plain",
    size: 4,
    uploadStatus: "ready",
    lastModified: "2026-08-05T00:00:00.000Z",
    link: "https://example.com/object",
    requirePendingReservation: true
}

const createR2 = () =>
    new R2({ lib: { reserveUpload: "reserveUpload" } } as never, {
        bucket: "uploads",
        endpoint: "https://account.r2.cloudflarestorage.com",
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key"
    })

describe("patched R2 direct uploads", () => {
    it("signs the exact size, MIME type, and no-overwrite condition", async () => {
        const upload = await createR2().generateUploadUrl("attachments/user-1/file.txt", {
            contentLength: 4,
            contentType: "text/plain",
            expiresIn: 600,
            ifNoneMatch: "*"
        })
        const signedUrl = new URL(upload.url)

        expect(signedUrl.searchParams.get("X-Amz-SignedHeaders")).toBe(
            "content-length;content-type;host;if-none-match"
        )
        expect(upload.headers).toEqual({
            "Content-Type": "text/plain",
            "If-None-Match": "*"
        })
    })

    it("persists the same constraints before handing the URL to the caller", async () => {
        const runMutation = vi.fn().mockResolvedValue(null)

        const upload = await createR2().createDirectUpload(
            { runMutation, runQuery: vi.fn() },
            {
                key: "attachments/user-1/file.txt",
                authorId: "user-1",
                contentLength: 4,
                contentType: "text/plain",
                expiresIn: 600,
                ifNoneMatch: "*"
            }
        )

        expect(runMutation).toHaveBeenCalledWith(
            "reserveUpload",
            expect.objectContaining({
                authorId: "user-1",
                key: upload.key,
                expectedSize: 4,
                expectedContentType: "text/plain",
                uploadExpiresAt: upload.expiresAt
            })
        )
    })

    it("does not recreate metadata after expiry atomically claims the reservation", async () => {
        const state = createMetadataContext(pendingMetadata())

        await expect(
            (deletePendingMetadata as unknown as MutationWithHandler)._handler(state.ctx, {
                authorId: "user-1",
                bucket: "uploads",
                key: "attachments/user-1/file.txt"
            })
        ).resolves.toBe(true)

        await expect(
            (upsertMetadata as unknown as MutationWithHandler)._handler(state.ctx, finalizeArgs)
        ).rejects.toThrow("no longer pending")
        expect(state.getMetadata()).toBeNull()
    })

    it("prevents expiry from claiming a reservation finalized first", async () => {
        const state = createMetadataContext(pendingMetadata())

        await expect(
            (upsertMetadata as unknown as MutationWithHandler)._handler(state.ctx, finalizeArgs)
        ).resolves.toEqual({ isNew: false })
        expect(state.getMetadata()).toMatchObject({ uploadStatus: "ready" })

        await expect(
            (upsertMetadata as unknown as MutationWithHandler)._handler(state.ctx, {
                ...finalizeArgs,
                contentType: "text/csv",
                size: 7
            })
        ).resolves.toEqual({ isNew: false })

        await expect(
            (deletePendingMetadata as unknown as MutationWithHandler)._handler(state.ctx, {
                authorId: "user-1",
                bucket: "uploads",
                key: "attachments/user-1/file.txt"
            })
        ).resolves.toBe(false)
        expect(state.deleteMock).not.toHaveBeenCalled()
    })

    it("finalizes with the size and MIME already enforced by the signed PUT", async () => {
        const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValueOnce({
            ContentLength: 7,
            ContentType: "text/csv",
            LastModified: new Date("2026-08-05T00:00:00.000Z")
        } as never)
        const runMutation = vi.fn().mockResolvedValue({ isNew: false })

        try {
            await (syncMetadata as unknown as MutationWithHandler)._handler(
                {
                    runQuery: vi.fn().mockResolvedValue(pendingMetadata()),
                    runMutation
                },
                {
                    key: "attachments/user-1/file.txt",
                    authorId: "user-1",
                    requireReservation: true,
                    bucket: "uploads",
                    endpoint: "https://account.r2.cloudflarestorage.com",
                    accessKeyId: "test-access-key",
                    secretAccessKey: "test-secret-key"
                }
            )
        } finally {
            send.mockRestore()
        }

        expect(runMutation).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                contentType: "text/plain",
                size: 4,
                requirePendingReservation: true
            })
        )
    })
})
