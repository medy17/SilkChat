import { v } from "convex/values"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import {
    getConfiguredCreditLimits,
    getCreditPeriodBounds,
    getCurrentCreditPeriodKey
} from "./lib/credits"
import { getUserIdentity } from "./lib/identity"

const getCreditAccount = async (ctx: QueryCtx | MutationCtx, userId: string) => {
    return await ctx.db
        .query("prototypeCreditAccounts")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .first()
}

const getResolvedCreditAccount = (
    account:
        | {
              enabled: boolean
              plan: "free" | "pro"
              monthlyBasicCredits: number
              monthlyProCredits: number
          }
        | null
        | undefined
) => {
    const plan = account?.plan ?? "free"
    const configuredLimits = getConfiguredCreditLimits(plan)
    return {
        enabled: account?.enabled ?? true,
        plan,
        monthlyBasicCredits: account?.monthlyBasicCredits ?? configuredLimits.basic,
        monthlyProCredits: account?.monthlyProCredits ?? configuredLimits.pro
    }
}

export const getUserCreditAccountInternal = internalQuery({
    args: {
        userId: v.string()
    },
    handler: async (ctx, { userId }) => {
        return await getCreditAccount(ctx, userId)
    }
})

export const getMyCreditSummary = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return null
        }

        const account = await getCreditAccount(ctx, user.id)
        const resolvedAccount = getResolvedCreditAccount(account)
        const periodKey = getCurrentCreditPeriodKey()
        const periodBounds = getCreditPeriodBounds()
        const events = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) => q.eq("userId", user.id).eq("periodKey", periodKey))
            .collect()

        const usedBasicCredits = events
            .filter((event) => event.counted && event.bucket === "basic")
            .reduce((sum, event) => sum + event.units, 0)
        const usedProCredits = events
            .filter((event) => event.counted && event.bucket === "pro")
            .reduce((sum, event) => sum + event.units, 0)
        const internalRequestCount = events.filter((event) => event.counted).length
        const byokRequestCount = events.filter((event) => !event.counted).length

        return {
            enabled: resolvedAccount.enabled,
            plan: resolvedAccount.plan,
            periodKey,
            periodStartsAt: periodBounds.startsAt,
            periodEndsAt: periodBounds.endsAt,
            basic: {
                limit: resolvedAccount.monthlyBasicCredits,
                used: usedBasicCredits,
                remaining: Math.max(0, resolvedAccount.monthlyBasicCredits - usedBasicCredits)
            },
            pro: {
                limit: resolvedAccount.monthlyProCredits,
                used: usedProCredits,
                remaining: Math.max(0, resolvedAccount.monthlyProCredits - usedProCredits)
            },
            requestCounts: {
                internal: internalRequestCount,
                byok: byokRequestCount,
                total: events.length
            }
        }
    }
})

export const getCreditUsageForUserInternal = internalQuery({
    args: {
        userId: v.string(),
        periodKey: v.optional(v.string())
    },
    handler: async (ctx, { userId, periodKey }) => {
        const resolvedPeriodKey = periodKey ?? getCurrentCreditPeriodKey()
        const periodBounds = getCreditPeriodBounds()
        const events = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) =>
                q.eq("userId", userId).eq("periodKey", resolvedPeriodKey)
            )
            .collect()

        return {
            periodKey: resolvedPeriodKey,
            periodStartsAt: periodBounds.startsAt,
            periodEndsAt: periodBounds.endsAt,
            usedBasicCredits: events
                .filter((event) => event.counted && event.bucket === "basic")
                .reduce((sum, event) => sum + event.units, 0),
            usedProCredits: events
                .filter((event) => event.counted && event.bucket === "pro")
                .reduce((sum, event) => sum + event.units, 0),
            requestCounts: {
                internal: events.filter((event) => event.counted).length,
                byok: events.filter((event) => !event.counted).length,
                total: events.length
            }
        }
    }
})

export const getMyCreditUsageSummary = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return null
        }

        const usage = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) =>
                q.eq("userId", user.id).eq("periodKey", getCurrentCreditPeriodKey())
            )
            .collect()

        const usedBasicCredits = usage
            .filter((event) => event.counted && event.bucket === "basic")
            .reduce((sum, event) => sum + event.units, 0)
        const usedProCredits = usage
            .filter((event) => event.counted && event.bucket === "pro")
            .reduce((sum, event) => sum + event.units, 0)
        const periodBounds = getCreditPeriodBounds()

        return {
            periodKey: getCurrentCreditPeriodKey(),
            periodStartsAt: periodBounds.startsAt,
            periodEndsAt: periodBounds.endsAt,
            basic: {
                used: usedBasicCredits
            },
            pro: {
                used: usedProCredits
            },
            requestCounts: {
                internal: usage.filter((event) => event.counted).length,
                byok: usage.filter((event) => !event.counted).length,
                total: usage.length
            }
        }
    }
})

export const setMyPrototypeCreditPlan = mutation({
    args: {
        enabled: v.optional(v.boolean()),
        plan: v.union(v.literal("free"), v.literal("pro")),
        monthlyBasicCredits: v.optional(v.number()),
        monthlyProCredits: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            throw new Error("Unauthorized")
        }

        const existingAccount = await getCreditAccount(ctx, user.id)
        const defaults = getConfiguredCreditLimits(args.plan)
        const nextAccount = {
            userId: user.id,
            enabled: args.enabled ?? existingAccount?.enabled ?? true,
            plan: args.plan,
            monthlyBasicCredits: args.monthlyBasicCredits ?? defaults.basic,
            monthlyProCredits: args.monthlyProCredits ?? defaults.pro,
            updatedAt: Date.now()
        }

        if (existingAccount?._id) {
            await ctx.db.patch(existingAccount._id, nextAccount)
        } else {
            await ctx.db.insert("prototypeCreditAccounts", nextAccount)
        }

        return nextAccount
    }
})

export const recordCreditEventForMessage = internalMutation({
    args: {
        userId: v.string(),
        threadId: v.optional(v.id("threads")),
        messageId: v.string(),
        messageKey: v.string(),
        modelId: v.optional(v.string()),
        providerSource: v.union(
            v.literal("internal"),
            v.literal("byok"),
            v.literal("openrouter"),
            v.literal("custom"),
            v.literal("unknown")
        ),
        feature: v.union(v.literal("chat"), v.literal("image"), v.literal("tool")),
        bucket: v.union(v.literal("basic"), v.literal("pro"), v.literal("none")),
        units: v.number(),
        counted: v.boolean()
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserMessageKey", (q) =>
                q.eq("userId", args.userId).eq("messageKey", args.messageKey)
            )
            .first()

        if (existing) {
            return existing._id
        }

        return await ctx.db.insert("prototypeCreditEvents", {
            ...args,
            periodKey: getCurrentCreditPeriodKey(),
            createdAt: Date.now()
        })
    }
})
