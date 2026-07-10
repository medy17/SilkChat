import { describe, expect, it, vi } from "vitest"

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return {
        v: new Proxy(
            {},
            {
                get: () => passthrough
            }
        )
    }
})

vi.mock("../../convex/_generated/server", () => ({
    action: (config: unknown) => config,
    httpAction: (handler: unknown) => handler,
    internalAction: (config: unknown) => config,
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    mutation: (config: unknown) => config,
    query: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    components: {
        betterAuth: {},
        r2: {},
        aggregateFolderThreads: {}
    },
    internal: {
        auth: {
            onAuthModelCreate: "onAuthModelCreate",
            onAuthModelUpdate: "onAuthModelUpdate",
            onAuthModelDelete: "onAuthModelDelete"
        },
        account_deletion: {
            processAccountDeletionJob: "processAccountDeletionJob"
        }
    }
}))

import {
    cancelMyFailedAccountDeletion,
    listProcessableAccountDeletionJobs,
    requestMyAccountDeletion
} from "../../convex/account_deletion"
import {
    buildSuppressedCreditAccountSeed,
    chooseCanonicalSuppression,
    fingerprintAccountIdentity,
    mergeSuppressionSnapshots,
    normalizeAccountDeletionEmail
} from "../../convex/lib/account_deletion"
import {
    getAnchoredMonthlyCreditPeriodBounds,
    getCreditPeriodKeyFromBounds
} from "../../convex/lib/credits"

const requestMyAccountDeletionHandler = requestMyAccountDeletion as unknown as {
    handler: (
        ctx: AccountDeletionTestCtx,
        args: {
            confirmationPhrase: string
            consentPermanentErasureAccepted: boolean
            consentFraudPreventionRetentionAccepted: boolean
        }
    ) => Promise<unknown>
}
const cancelMyFailedAccountDeletionHandler = cancelMyFailedAccountDeletion as unknown as {
    handler: (ctx: AccountDeletionTestCtx, args: Record<string, never>) => Promise<unknown>
}
const listProcessableAccountDeletionJobsHandler = listProcessableAccountDeletionJobs as unknown as {
    handler: (
        ctx: {
            db: {
                query: ReturnType<typeof vi.fn>
            }
        },
        args: { limit?: number }
    ) => Promise<Array<{ userId: string }>>
}

type AccountDeletionTestCtx = {
    auth: {
        getUserIdentity: ReturnType<typeof vi.fn>
    }
    db: {
        query: ReturnType<typeof vi.fn>
        insert: ReturnType<typeof vi.fn>
        patch: ReturnType<typeof vi.fn>
    }
    scheduler: {
        runAfter: ReturnType<typeof vi.fn>
    }
}

const createDeletionCtx = (existingJob: Record<string, unknown> | null = null) =>
    ({
        auth: {
            getUserIdentity: vi.fn().mockResolvedValue({
                subject: "auth-user-1",
                userId: "user-1",
                isAnonymous: false
            })
        },
        db: {
            query: vi.fn().mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    first: vi.fn().mockResolvedValue(existingJob)
                })
            }),
            insert: vi.fn().mockResolvedValue("job-1"),
            patch: vi.fn()
        },
        scheduler: {
            runAfter: vi.fn()
        }
    }) as AccountDeletionTestCtx

describe("account deletion helpers", () => {
    it("normalizes Gmail aliases for deletion fingerprints", () => {
        expect(normalizeAccountDeletionEmail(" A.B+C@GoogleMail.com ")).toBe("ab@gmail.com")
        expect(normalizeAccountDeletionEmail("person+tag@example.com")).toBe(
            "person+tag@example.com"
        )
    })

    it("fingerprints normalized email and raw Google subject with HMAC-SHA256", async () => {
        const first = await fingerprintAccountIdentity({
            pepper: "stable-pepper",
            email: "a.b+x@gmail.com",
            googleSub: "google-sub-1"
        })
        const second = await fingerprintAccountIdentity({
            pepper: "stable-pepper",
            email: "ab@gmail.com",
            googleSub: "google-sub-1"
        })

        expect(first).toEqual(second)
        expect(first.emailHash).toMatch(/^[a-f0-9]{64}$/)
        expect(first.googleSubHash).toMatch(/^[a-f0-9]{64}$/)
    })

    it("prefers Google-sub tombstone matches over email-only matches", () => {
        const canonical = chooseCanonicalSuppression({
            googleSubHash: "sub-hash",
            matches: [
                {
                    _id: "email-only",
                    emailHash: "email-hash",
                    freePeriodKey: "period",
                    freeConsumedBasicUnits: 10,
                    refundCount: 0,
                    firstDeletedAt: 1,
                    lastDeletedAt: 1
                },
                {
                    _id: "google-match",
                    googleSubHash: "sub-hash",
                    emailHash: "old-email-hash",
                    freePeriodKey: "period",
                    freeConsumedBasicUnits: 5,
                    refundCount: 0,
                    firstDeletedAt: 2,
                    lastDeletedAt: 2
                }
            ]
        })

        expect(canonical?._id).toBe("google-match")
    })

    it("merges suppression counters conservatively", () => {
        expect(
            mergeSuppressionSnapshots({
                freePeriodKey: "period",
                matches: [
                    {
                        _id: "older",
                        emailHash: "email-hash",
                        freePeriodKey: "period",
                        freeConsumedBasicUnits: 3,
                        proEntitlementEndsAt: 100,
                        refundCount: 1,
                        firstDeletedAt: 1,
                        lastDeletedAt: 3
                    },
                    {
                        _id: "newer",
                        emailHash: "email-hash",
                        freePeriodKey: "period",
                        freeConsumedBasicUnits: 9,
                        proEntitlementEndsAt: 50,
                        refundCount: 2,
                        firstDeletedAt: 2,
                        lastDeletedAt: 4
                    }
                ]
            })
        ).toMatchObject({
            freeConsumedBasicUnits: 9,
            proEntitlementEndsAt: 100,
            refundCount: 2,
            firstDeletedAt: 1,
            lastDeletedAt: 4
        })
    })

    it("merges free usage for the requested period instead of the first match", () => {
        expect(
            mergeSuppressionSnapshots({
                freePeriodKey: "current-period",
                matches: [
                    {
                        _id: "older-period",
                        emailHash: "email-hash",
                        freePeriodKey: "old-period",
                        freeConsumedBasicUnits: 19,
                        refundCount: 0,
                        firstDeletedAt: 1,
                        lastDeletedAt: 1
                    },
                    {
                        _id: "current-period",
                        emailHash: "email-hash",
                        freePeriodKey: "current-period",
                        freeConsumedBasicUnits: 8,
                        refundCount: 0,
                        firstDeletedAt: 2,
                        lastDeletedAt: 2
                    }
                ]
            })
        ).toMatchObject({
            freePeriodKey: "current-period",
            freeConsumedBasicUnits: 8
        })
    })

    it("seeds deleted-account credit carry-in for the matching anchored window", () => {
        const anchorAt = Date.UTC(2026, 5, 23, 8, 48, 45, 602)
        const now = Date.UTC(2026, 6, 8, 10, 0, 0, 0)
        const periodKey = getCreditPeriodKeyFromBounds(
            getAnchoredMonthlyCreditPeriodBounds({
                timestamp: now,
                anchorTimestamp: anchorAt
            })
        )

        expect(
            buildSuppressedCreditAccountSeed({
                userId: "new-user",
                now,
                currentFreePeriodKey: periodKey,
                suppression: {
                    freeAnchorAt: anchorAt,
                    freePeriodKey: periodKey,
                    freeConsumedBasicUnits: 20,
                    usagePeriodKey: periodKey,
                    consumedUsageMicrousd: 725_000,
                    everWasPro: false,
                    refundCount: 0
                }
            })
        ).toMatchObject({
            userId: "new-user",
            plan: "free",
            creditPeriodAnchorAt: anchorAt,
            carriedForPeriodKey: periodKey,
            carriedBasicUnits: 20,
            carriedUsageMicrousd: 725_000
        })
    })

    it("keeps the original anchor but drops carry-in after the deleted window rolls", () => {
        const anchorAt = Date.UTC(2026, 5, 23, 8, 48, 45, 602)
        const deletedPeriodKey = getCreditPeriodKeyFromBounds(
            getAnchoredMonthlyCreditPeriodBounds({
                timestamp: Date.UTC(2026, 6, 8, 10, 0, 0, 0),
                anchorTimestamp: anchorAt
            })
        )
        const now = Date.UTC(2026, 7, 8, 10, 0, 0, 0)
        const currentPeriodKey = getCreditPeriodKeyFromBounds(
            getAnchoredMonthlyCreditPeriodBounds({
                timestamp: now,
                anchorTimestamp: anchorAt
            })
        )

        expect(currentPeriodKey).not.toBe(deletedPeriodKey)
        expect(
            buildSuppressedCreditAccountSeed({
                userId: "new-user",
                now,
                currentFreePeriodKey: currentPeriodKey,
                suppression: {
                    freeAnchorAt: anchorAt,
                    freePeriodKey: deletedPeriodKey,
                    freeConsumedBasicUnits: 20,
                    usagePeriodKey: deletedPeriodKey,
                    consumedUsageMicrousd: 725_000,
                    everWasPro: false,
                    refundCount: 0
                }
            })
        ).toMatchObject({
            userId: "new-user",
            plan: "free",
            creditPeriodAnchorAt: anchorAt,
            carriedForPeriodKey: undefined,
            carriedBasicUnits: undefined,
            carriedUsageMicrousd: undefined
        })
    })
})

describe("account deletion request mutation", () => {
    it("rejects a mismatched confirmation phrase", async () => {
        await expect(
            requestMyAccountDeletionHandler.handler(createDeletionCtx(), {
                confirmationPhrase: "delete my account",
                consentPermanentErasureAccepted: true,
                consentFraudPreventionRetentionAccepted: true
            })
        ).rejects.toThrow("Confirmation phrase does not match")
    })

    it("stores pending deletion consent for the authenticated user", async () => {
        const ctx = createDeletionCtx()

        await expect(
            requestMyAccountDeletionHandler.handler(ctx, {
                confirmationPhrase: "Delete my account",
                consentPermanentErasureAccepted: true,
                consentFraudPreventionRetentionAccepted: true
            })
        ).resolves.toMatchObject({
            status: "pending",
            phase: "user_confirmed"
        })

        expect(ctx.db.insert).toHaveBeenCalledWith(
            "accountDeletionJobs",
            expect.objectContaining({
                userId: "user-1",
                authId: "auth-user-1",
                status: "pending",
                confirmationPhrase: "Delete my account",
                consentPermanentErasureAccepted: true,
                consentFraudPreventionRetentionAccepted: true,
                phase: "user_confirmed"
            })
        )
    })

    it("rejects a duplicate request while deletion is active", async () => {
        await expect(
            requestMyAccountDeletionHandler.handler(
                createDeletionCtx({
                    _id: "job-1",
                    userId: "user-1",
                    status: "purging",
                    createdAt: 1,
                    updatedAt: 1
                }),
                {
                    confirmationPhrase: "Delete my account",
                    consentPermanentErasureAccepted: true,
                    consentFraudPreventionRetentionAccepted: true
                }
            )
        ).rejects.toThrow("Account deletion is already in progress")
    })

    it("allows a terminal failed request to be requested again", async () => {
        const ctx = createDeletionCtx({
            _id: "job-1",
            userId: "user-1",
            status: "failed",
            retryCount: 5,
            createdAt: 1,
            updatedAt: 1
        })

        await expect(
            requestMyAccountDeletionHandler.handler(ctx, {
                confirmationPhrase: "Delete my account",
                consentPermanentErasureAccepted: true,
                consentFraudPreventionRetentionAccepted: true
            })
        ).resolves.toMatchObject({
            status: "pending",
            phase: "user_confirmed"
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "job-1",
            expect.objectContaining({
                authId: "auth-user-1",
                status: "pending",
                retryCount: 0,
                error: undefined
            })
        )
    })

    it("lets the user cancel a terminal failed request", async () => {
        const ctx = createDeletionCtx({
            _id: "job-1",
            userId: "user-1",
            status: "failed",
            retryCount: 5,
            createdAt: 1,
            updatedAt: 1
        })

        await expect(cancelMyFailedAccountDeletionHandler.handler(ctx, {})).resolves.toMatchObject({
            status: "cancelled"
        })

        expect(ctx.db.patch).toHaveBeenCalledWith(
            "job-1",
            expect.objectContaining({
                status: "cancelled",
                phase: "cancelled",
                error: undefined
            })
        )
    })
})

describe("account deletion job sweep", () => {
    it("returns active pending, purging, and retrying jobs for post-deploy processing", async () => {
        const rowsByStatus = {
            pending: [{ userId: "pending-user", updatedAt: 20 }],
            purging: [{ userId: "purging-user", updatedAt: 10 }],
            retrying: [{ userId: "retrying-user", updatedAt: 30 }],
            failed: [{ userId: "failed-user", updatedAt: 40 }]
        } as Record<string, Array<{ userId: string; updatedAt: number }>>

        const ctx = {
            db: {
                query: vi.fn(() => ({
                    withIndex: vi.fn((_indexName, buildQuery) => {
                        let selectedStatus = ""
                        buildQuery({
                            eq: vi.fn((_field, status) => {
                                selectedStatus = status
                                return {}
                            })
                        })

                        return {
                            take: vi.fn(async (limit: number) =>
                                (rowsByStatus[selectedStatus] ?? []).slice(0, limit)
                            )
                        }
                    })
                }))
            }
        }

        await expect(
            listProcessableAccountDeletionJobsHandler.handler(ctx, { limit: 10 })
        ).resolves.toEqual([
            { userId: "purging-user" },
            { userId: "pending-user" },
            { userId: "retrying-user" }
        ])
    })
})
