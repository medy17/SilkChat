import { describe, expect, it, vi } from "vitest"
import {
    claimImageGenerationJobAssetRetry,
    claimImageGenerationJobForWebhook
} from "../../convex/image_generation_jobs"

type ClaimCtx = {
    db: {
        query: ReturnType<typeof vi.fn>
        patch: ReturnType<typeof vi.fn>
    }
}

const createClaimCtx = (job: { _id: string; status: string } | null): ClaimCtx =>
    ({
        db: {
            query: vi.fn(() => ({
                withIndex: vi.fn(() => ({
                    first: vi.fn(async () => job)
                }))
            })),
            patch: vi.fn()
        }
    }) as ClaimCtx

const claimImageGenerationJobForWebhookHandler = claimImageGenerationJobForWebhook as unknown as (
    ctx: ClaimCtx,
    args: { falRequestId: string }
) => Promise<{ claimed: boolean; status: string; jobId?: string }>

type RetryJob = {
    _id: string
    userId: string
    status: string
    falRequestId: string
    prompt?: string
    appModelId?: string
    aspectRatio?: string
    resolution?: string
    referenceImageKeys?: string[]
    assetUrls?: { url: string; contentType?: string }[]
    assetFetchAttempts?: number
    lastAssetFetchAttemptAt?: number
}

type RetryCtx = {
    db: {
        get: ReturnType<typeof vi.fn>
        patch: ReturnType<typeof vi.fn>
    }
}

const createRetryCtx = (job: RetryJob | null): RetryCtx =>
    ({
        db: {
            get: vi.fn(async () => job),
            patch: vi.fn()
        }
    }) as RetryCtx

const claimImageGenerationJobAssetRetryHandler = claimImageGenerationJobAssetRetry as unknown as (
    ctx: RetryCtx,
    args: { jobId: string; userId: string }
) => Promise<{ claimed: boolean; reason?: string; message?: string }>

describe("image_generation_jobs", () => {
    it("atomically claims only submitted jobs for fal webhook processing", async () => {
        const ctx = createClaimCtx({ _id: "job-1", status: "submitted" })

        await expect(
            claimImageGenerationJobForWebhookHandler(ctx, { falRequestId: "fal-request-1" })
        ).resolves.toMatchObject({
            claimed: true,
            status: "processing",
            jobId: "job-1"
        })
        expect(ctx.db.patch).toHaveBeenCalledWith("job-1", {
            status: "processing",
            updatedAt: expect.any(Number)
        })
    })

    it("does not claim jobs already processing or terminal", async () => {
        const processingCtx = createClaimCtx({ _id: "job-1", status: "processing" })
        await expect(
            claimImageGenerationJobForWebhookHandler(processingCtx, {
                falRequestId: "fal-request-1"
            })
        ).resolves.toMatchObject({
            claimed: false,
            status: "processing"
        })
        expect(processingCtx.db.patch).not.toHaveBeenCalled()

        const completedCtx = createClaimCtx({ _id: "job-1", status: "completed" })
        await expect(
            claimImageGenerationJobForWebhookHandler(completedCtx, {
                falRequestId: "fal-request-1"
            })
        ).resolves.toMatchObject({
            claimed: false,
            status: "completed"
        })
        expect(completedCtx.db.patch).not.toHaveBeenCalled()
    })

    it("claims a storing_failed job for a user-requested asset retry", async () => {
        const ctx = createRetryCtx({
            _id: "job-1",
            userId: "user-1",
            status: "storing_failed",
            falRequestId: "fal-request-1",
            assetUrls: [{ url: "https://v3b.fal.media/files/b/image.png" }],
            assetFetchAttempts: 1
        })

        await expect(
            claimImageGenerationJobAssetRetryHandler(ctx, { jobId: "job-1", userId: "user-1" })
        ).resolves.toMatchObject({ claimed: true })
        expect(ctx.db.patch).toHaveBeenCalledWith("job-1", {
            status: "processing",
            assetFetchAttempts: 2,
            lastAssetFetchAttemptAt: expect.any(Number),
            updatedAt: expect.any(Number)
        })
    })

    it("treats an already-stored job as a no-op retry", async () => {
        const ctx = createRetryCtx({
            _id: "job-1",
            userId: "user-1",
            status: "completed",
            falRequestId: "fal-request-1"
        })

        await expect(
            claimImageGenerationJobAssetRetryHandler(ctx, { jobId: "job-1", userId: "user-1" })
        ).resolves.toMatchObject({ claimed: false, reason: "already_stored" })
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("rejects retries past the per-job attempt cap", async () => {
        const ctx = createRetryCtx({
            _id: "job-1",
            userId: "user-1",
            status: "storing_failed",
            falRequestId: "fal-request-1",
            assetFetchAttempts: 5
        })

        await expect(
            claimImageGenerationJobAssetRetryHandler(ctx, { jobId: "job-1", userId: "user-1" })
        ).resolves.toMatchObject({ claimed: false, reason: "limit" })
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("rejects retries inside the cooldown window", async () => {
        const ctx = createRetryCtx({
            _id: "job-1",
            userId: "user-1",
            status: "storing_failed",
            falRequestId: "fal-request-1",
            assetFetchAttempts: 1,
            lastAssetFetchAttemptAt: Date.now()
        })

        await expect(
            claimImageGenerationJobAssetRetryHandler(ctx, { jobId: "job-1", userId: "user-1" })
        ).resolves.toMatchObject({ claimed: false, reason: "cooldown" })
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })

    it("does not let a different user claim someone else's job", async () => {
        const ctx = createRetryCtx({
            _id: "job-1",
            userId: "owner",
            status: "storing_failed",
            falRequestId: "fal-request-1"
        })

        await expect(
            claimImageGenerationJobAssetRetryHandler(ctx, { jobId: "job-1", userId: "intruder" })
        ).resolves.toMatchObject({ claimed: false, reason: "not_found" })
        expect(ctx.db.patch).not.toHaveBeenCalled()
    })
})
