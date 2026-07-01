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
    mutation: (config: unknown) => config,
    query: (config: unknown) => config
}))

import { requestMyAccountDeletion } from "../../convex/account_deletion"
import {
    chooseCanonicalSuppression,
    fingerprintAccountIdentity,
    mergeSuppressionSnapshots,
    normalizeAccountDeletionEmail
} from "../../convex/lib/account_deletion"

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

type AccountDeletionTestCtx = {
    auth: {
        getUserIdentity: ReturnType<typeof vi.fn>
    }
    db: {
        query: ReturnType<typeof vi.fn>
        insert: ReturnType<typeof vi.fn>
        patch: ReturnType<typeof vi.fn>
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
                status: "pending",
                confirmationPhrase: "Delete my account",
                consentPermanentErasureAccepted: true,
                consentFraudPreventionRetentionAccepted: true,
                phase: "user_confirmed"
            })
        )
    })
})
