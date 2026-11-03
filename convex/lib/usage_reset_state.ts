import { components } from "../_generated/api"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import {
    EMPTY_USAGE_BREAKPOINTS,
    type UsageBreakpoints,
    type UsageResetPlan,
    applyResetToBreakpoints,
    mergeBreakpoints,
    pruneBreakpoints,
    readAccountBreakpoints
} from "./usage_resets"

type Ctx = QueryCtx | MutationCtx

type AuthUserRecord = { createdAt?: number } | null

// App user IDs are either the auth user's legacy userId field or its _id.
export const getUserSignedUpAt = async (ctx: Ctx, userId: string): Promise<number | null> => {
    let user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "userId", value: userId }]
    })) as AuthUserRecord
    if (!user) {
        try {
            user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
                model: "user",
                where: [{ field: "_id", value: userId }]
            })) as AuthUserRecord
        } catch {
            user = null
        }
    }
    return typeof user?.createdAt === "number" ? user.createdAt : null
}

export const listGlobalUsageResets = async (
    ctx: Ctx,
    delivery: "instant" | "banked",
    since?: number
) =>
    await ctx.db
        .query("usageResetGrants")
        .withIndex("byScopeDeliveryCreatedAt", (q) =>
            since === undefined
                ? q.eq("scope", "global").eq("delivery", delivery)
                : q.eq("scope", "global").eq("delivery", delivery).gte("createdAt", since)
        )
        .collect()

type GlobalGrant = {
    plan?: UsageResetPlan
    signedUpBefore?: number
    revokedAt?: number
    createdAt: number
}

// Resolves the signup cutoff without a lookup when the credit account already predates it;
// accounts are created after signup, so that proves eligibility.
export const createGlobalGrantEligibility = (
    ctx: Ctx,
    {
        userId,
        plan,
        accountCreatedAt
    }: { userId: string; plan: UsageResetPlan; accountCreatedAt?: number }
) => {
    let signedUpAt: number | null | undefined
    return async (grant: GlobalGrant) => {
        if (grant.revokedAt !== undefined) return false
        if (grant.plan && grant.plan !== plan) return false
        if (grant.signedUpBefore === undefined) return true
        if (accountCreatedAt !== undefined && accountCreatedAt <= grant.signedUpBefore) return true
        if (signedUpAt === undefined) signedUpAt = await getUserSignedUpAt(ctx, userId)
        return signedUpAt !== null && signedUpAt <= grant.signedUpBefore
    }
}

export const resolveUsageBreakpoints = async (
    ctx: Ctx,
    {
        userId,
        plan,
        account,
        periodStartsAt,
        now
    }: {
        userId: string
        plan: UsageResetPlan
        account:
            | {
                  _creationTime?: number
                  usageResetFiveHourAt?: number
                  usageResetMonthlyAt?: number
                  usageResetWeekly?: { at: number; fraction: number }[]
              }
            | null
            | undefined
        periodStartsAt: number
        now: number
    }
): Promise<UsageBreakpoints> => {
    const own = readAccountBreakpoints(account)
    // An account created in this transaction has no usage for a reset to clear.
    if (account?._creationTime === undefined) return pruneBreakpoints(own, periodStartsAt)

    const isEligible = createGlobalGrantEligibility(ctx, {
        userId,
        plan,
        accountCreatedAt: account._creationTime
    })
    let global = EMPTY_USAGE_BREAKPOINTS
    for (const grant of await listGlobalUsageResets(ctx, "instant", periodStartsAt)) {
        if (grant.createdAt > now || !(await isEligible(grant))) continue
        global = applyResetToBreakpoints(global, grant, grant.createdAt)
    }
    return pruneBreakpoints(mergeBreakpoints(own, global), periodStartsAt)
}
