import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return { v: new Proxy({}, { get: () => passthrough }) }
})

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    query: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        account_exports_node: {
            buildAccountExport: "buildAccountExport",
            deliverAccountExportEmail: "deliverAccountExportEmail"
        }
    }
}))

vi.mock("../../convex/lib/account_deletion_status", () => ({
    assertAccountNotDeleting: vi.fn()
}))

import {
    ACCOUNT_EXPORT_COOLDOWN_MS,
    ACCOUNT_EXPORT_EMAIL_RETRY_BASE_MS,
    claimAccountExportBuild,
    getAccountExportEmailRetryDelayMs,
    reserveAccountExport
} from "../../convex/account_exports"

const requestHandler = (
    reserveAccountExport as unknown as {
        handler: (
            ctx: AccountExportTestCtx,
            args: {
                userId: string
                authId: string
                email: string
                keyHash: string
                encryptedPassword: string
                consentSensitiveDataLinksAccepted: boolean
                consentOneTimePasswordAccepted: boolean
            }
        ) => Promise<unknown>
    }
).handler
const claimHandler = (
    claimAccountExportBuild as unknown as {
        handler: (
            ctx: AccountExportClaimTestCtx,
            args: { jobId: string; userId: string }
        ) => Promise<{ objectKey: string; email: string } | null>
    }
).handler

type AccountExportTestCtx = {
    db: {
        query: ReturnType<typeof vi.fn>
        insert: ReturnType<typeof vi.fn>
    }
    scheduler: {
        runAfter: ReturnType<typeof vi.fn>
    }
}

type AccountExportClaimTestCtx = {
    db: {
        get: ReturnType<typeof vi.fn>
        patch: ReturnType<typeof vi.fn>
    }
}

beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv("RESEND_API_KEY", "resend-key")
    vi.stubEnv("EMAIL_PROVIDER", "resend")
    vi.stubEnv("R2_BUCKET", "bucket")
    vi.stubEnv("R2_FORCE_PATH_STYLE", "true")
    vi.stubEnv("R2_ENDPOINT", "https://r2.example.com")
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key")
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key")
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://files.example.com")
    vi.stubEnv("SITE_URL", "https://silkchat.dev")
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe("account export reservation", () => {
    it("atomically reserves the cooldown before export work starts", async () => {
        const now = 1_800_000_000_000
        vi.spyOn(Date, "now").mockReturnValue(now)
        const ctx = {
            db: {
                query: vi.fn().mockReturnValue({
                    withIndex: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                            first: vi.fn().mockResolvedValue(null)
                        })
                    })
                }),
                insert: vi.fn().mockResolvedValue("job-1")
            },
            scheduler: {
                runAfter: vi.fn()
            }
        }

        await expect(
            requestHandler(ctx, {
                userId: "user-1",
                authId: "auth-1",
                email: "person@example.com",
                keyHash: "a".repeat(64),
                encryptedPassword: "encrypted-export-password",
                consentSensitiveDataLinksAccepted: true,
                consentOneTimePasswordAccepted: true
            })
        ).resolves.toEqual({
            accepted: true,
            jobId: "job-1",
            nextRequestAt: now + ACCOUNT_EXPORT_COOLDOWN_MS
        })
        expect(ctx.db.insert).toHaveBeenCalledWith(
            "accountExportJobs",
            expect.objectContaining({
                userId: "user-1",
                email: "person@example.com",
                status: "reserved",
                createdAt: now
            })
        )
        expect(ctx.db.insert.mock.calls[0]?.[1]).not.toHaveProperty("password")
        expect(ctx.db.insert.mock.calls[0]?.[1]).not.toHaveProperty("encryptedPassword")
        expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
            0,
            "buildAccountExport",
            expect.objectContaining({
                jobId: "job-1",
                userId: "user-1",
                encryptedPassword: "encrypted-export-password"
            })
        )
    })

    it("rejects requests inside the 24-hour window without inserting another job", async () => {
        const now = 1_800_000_000_000
        vi.spyOn(Date, "now").mockReturnValue(now)
        const createdAt = now - 1000
        const ctx = {
            db: {
                query: vi.fn().mockReturnValue({
                    withIndex: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                            first: vi.fn().mockResolvedValue({
                                status: "delivered",
                                createdAt,
                                updatedAt: createdAt
                            })
                        })
                    })
                }),
                insert: vi.fn()
            },
            scheduler: {
                runAfter: vi.fn()
            }
        }

        await expect(
            requestHandler(ctx, {
                userId: "user-1",
                authId: "auth-1",
                email: "person@example.com",
                keyHash: "b".repeat(64),
                encryptedPassword: "encrypted-export-password",
                consentSensitiveDataLinksAccepted: true,
                consentOneTimePasswordAccepted: true
            })
        ).resolves.toEqual({
            accepted: false,
            nextRequestAt: createdAt + ACCOUNT_EXPORT_COOLDOWN_MS
        })
        expect(ctx.db.insert).not.toHaveBeenCalled()
    })

    it("retains the 24-hour lock when the previous export failed", async () => {
        const now = 1_800_000_000_000
        vi.spyOn(Date, "now").mockReturnValue(now)
        const createdAt = now - 1000
        const ctx = {
            db: {
                query: vi.fn().mockReturnValue({
                    withIndex: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                            first: vi.fn().mockResolvedValue({
                                status: "failed",
                                createdAt,
                                updatedAt: now
                            })
                        })
                    })
                }),
                insert: vi.fn()
            },
            scheduler: {
                runAfter: vi.fn()
            }
        }

        await expect(
            requestHandler(ctx, {
                userId: "user-1",
                authId: "auth-1",
                email: "person@example.com",
                keyHash: "c".repeat(64),
                encryptedPassword: "encrypted-export-password",
                consentSensitiveDataLinksAccepted: true,
                consentOneTimePasswordAccepted: true
            })
        ).resolves.toEqual({
            accepted: false,
            nextRequestAt: createdAt + ACCOUNT_EXPORT_COOLDOWN_MS
        })
        expect(ctx.db.insert).not.toHaveBeenCalled()
        expect(ctx.scheduler.runAfter).not.toHaveBeenCalled()
    })

    it("backs email retries off exponentially from five minutes", () => {
        expect([0, 1, 2].map(getAccountExportEmailRetryDelayMs)).toEqual([
            ACCOUNT_EXPORT_EMAIL_RETRY_BASE_MS,
            ACCOUNT_EXPORT_EMAIL_RETRY_BASE_MS * 2,
            ACCOUNT_EXPORT_EMAIL_RETRY_BASE_MS * 4
        ])
    })

    it("does not consume the cooldown for an invalid export key fingerprint", async () => {
        const ctx = {
            db: {
                query: vi.fn(),
                insert: vi.fn()
            },
            scheduler: {
                runAfter: vi.fn()
            }
        }

        await expect(
            requestHandler(ctx, {
                userId: "user-1",
                authId: "auth-1",
                email: "person@example.com",
                keyHash: "invalid",
                encryptedPassword: "encrypted-export-password",
                consentSensitiveDataLinksAccepted: true,
                consentOneTimePasswordAccepted: true
            })
        ).rejects.toThrow("Invalid export key fingerprint")
        expect(ctx.db.query).not.toHaveBeenCalled()
        expect(ctx.db.insert).not.toHaveBeenCalled()
    })

    it("allows only the reserved owner and state to claim a build", async () => {
        const patch = vi.fn()
        const validCtx = {
            db: {
                get: vi.fn().mockResolvedValue({
                    userId: "user-1",
                    email: "person@example.com",
                    status: "reserved"
                }),
                patch
            }
        }
        await expect(claimHandler(validCtx, { jobId: "job-1", userId: "user-1" })).resolves.toEqual(
            {
                objectKey: "account-exports/user-1/job-1.zip",
                email: "person@example.com"
            }
        )
        expect(patch).toHaveBeenCalledWith("job-1", expect.objectContaining({ status: "building" }))

        const alreadyClaimedCtx = {
            db: {
                get: vi.fn().mockResolvedValue({
                    userId: "user-1",
                    status: "building"
                }),
                patch: vi.fn()
            }
        }
        await expect(
            claimHandler(alreadyClaimedCtx, { jobId: "job-1", userId: "user-1" })
        ).resolves.toBeNull()
    })
})
