import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"

export const ACCOUNT_DELETION_CONFIRMATION_PHRASE = "Delete my account"

const getAccountDeletionJob = async (ctx: QueryCtx | MutationCtx, userId: string) => {
    return await ctx.db
        .query("accountDeletionJobs")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .first()
}

export const getMyAccountDeletionRequest = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null

        const job = await getAccountDeletionJob(ctx, user.id)
        if (!job) return null

        return {
            status: job.status,
            phase: job.phase,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            consentAcceptedAt: job.consentAcceptedAt
        }
    }
})

export const requestMyAccountDeletion = mutation({
    args: {
        confirmationPhrase: v.string(),
        consentPermanentErasureAccepted: v.boolean(),
        consentFraudPreventionRetentionAccepted: v.boolean()
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            throw new Error("Unauthorized")
        }

        if (args.confirmationPhrase !== ACCOUNT_DELETION_CONFIRMATION_PHRASE) {
            throw new Error("Confirmation phrase does not match")
        }

        if (
            !args.consentPermanentErasureAccepted ||
            !args.consentFraudPreventionRetentionAccepted
        ) {
            throw new Error("Required deletion consent was not accepted")
        }

        const now = Date.now()
        const existingJob = await getAccountDeletionJob(ctx, user.id)
        const nextJob = {
            userId: user.id,
            status: "pending" as const,
            phase: "user_confirmed",
            error: undefined,
            confirmationPhrase: args.confirmationPhrase,
            consentPermanentErasureAccepted: args.consentPermanentErasureAccepted,
            consentFraudPreventionRetentionAccepted: args.consentFraudPreventionRetentionAccepted,
            consentAcceptedAt: now,
            createdAt: existingJob?.createdAt ?? now,
            updatedAt: now
        }

        if (existingJob?._id) {
            await ctx.db.patch(existingJob._id, nextJob)
        } else {
            await ctx.db.insert("accountDeletionJobs", nextJob)
        }

        return {
            status: nextJob.status,
            phase: nextJob.phase,
            consentAcceptedAt: nextJob.consentAcceptedAt
        }
    }
})
