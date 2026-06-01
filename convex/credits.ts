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

type CreditAccountRecord = {
    enabled: boolean
    plan: "free" | "pro"
    monthlyBasicCredits?: number
    monthlyProCredits?: number
}

type UserAccessRecord = {
    isStaff: boolean
    bypassLimits: boolean
}

const getCreditAccount = async (ctx: QueryCtx | MutationCtx, userId: string) => {
    return await ctx.db
        .query("prototypeCreditAccounts")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .first()
}

const getUserAccess = async (ctx: QueryCtx | MutationCtx, userId: string) => {
    return await ctx.db
        .query("userAccess")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .first()
}

const getToolCallReservation = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    messageKey: string
) => {
    return await ctx.db
        .query("prototypeToolCallReservations")
        .withIndex("byUserMessageKey", (q) => q.eq("userId", userId).eq("messageKey", messageKey))
        .first()
}

const getCreditReservation = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    messageKey: string
) => {
    return await ctx.db
        .query("prototypeCreditReservations")
        .withIndex("byUserMessageKey", (q) => q.eq("userId", userId).eq("messageKey", messageKey))
        .first()
}

const getResolvedCreditAccount = (account: CreditAccountRecord | null | undefined) => {
    const plan = account?.plan ?? "free"
    const configuredLimits = getConfiguredCreditLimits(plan)
    return {
        enabled: account?.enabled ?? true,
        plan,
        monthlyBasicCredits: account?.monthlyBasicCredits ?? configuredLimits.basic,
        monthlyProCredits: account?.monthlyProCredits ?? configuredLimits.pro
    }
}

const getResolvedCreditPlan = (account: CreditAccountRecord | null | undefined) =>
    getResolvedCreditAccount(account).plan

const getResolvedUserAccess = (access: UserAccessRecord | null | undefined) => ({
    isStaff: access?.isStaff ?? false,
    bypassLimits: access?.bypassLimits ?? false
})

const getOutstandingReservedBasicCredits = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    periodKey: string
) => {
    const reservations = await ctx.db
        .query("prototypeToolCallReservations")
        .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
        .collect()

    return reservations
        .filter((reservation) => reservation.active)
        .reduce(
            (sum, reservation) =>
                sum +
                Math.max(0, reservation.reservedBasicCredits - reservation.consumedBasicCredits),
            0
        )
}

const getOutstandingReservedCreditUnits = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    periodKey: string,
    bucket: "basic" | "pro"
) => {
    const reservations = await ctx.db
        .query("prototypeCreditReservations")
        .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
        .collect()

    return reservations
        .filter(
            (reservation) =>
                reservation.active && reservation.counted && reservation.bucket === bucket
        )
        .reduce((sum, reservation) => sum + reservation.units, 0)
}

const getOutstandingReservedUnitsForBucket = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    periodKey: string,
    bucket: "basic" | "pro"
) => {
    const reservedCredits = await getOutstandingReservedCreditUnits(ctx, userId, periodKey, bucket)

    if (bucket === "basic") {
        return reservedCredits + (await getOutstandingReservedBasicCredits(ctx, userId, periodKey))
    }

    return reservedCredits
}

export const getUserCreditAccountInternal = internalQuery({
    args: {
        userId: v.string()
    },
    handler: async (ctx, { userId }) => {
        return await getCreditAccount(ctx, userId)
    }
})

export const getUserCreditPlanInternal = internalQuery({
    args: {
        userId: v.string()
    },
    handler: async (ctx, { userId }) => {
        const account = await getCreditAccount(ctx, userId)
        return getResolvedCreditPlan(account)
    }
})

export const getUserCreditStateInternal = internalQuery({
    args: {
        userId: v.string()
    },
    handler: async (ctx, { userId }) => {
        const [account, access] = await Promise.all([
            getCreditAccount(ctx, userId),
            getUserAccess(ctx, userId)
        ])
        const resolvedAccount = getResolvedCreditAccount(account)
        const resolvedAccess = getResolvedUserAccess(access)

        return {
            enabled: resolvedAccount.enabled,
            plan: resolvedAccount.plan,
            isStaff: resolvedAccess.isStaff,
            bypassLimits: resolvedAccess.bypassLimits
        }
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
        const [reservedBasicCredits, reservedProCredits] = await Promise.all([
            getOutstandingReservedUnitsForBucket(ctx, user.id, periodKey, "basic"),
            getOutstandingReservedUnitsForBucket(ctx, user.id, periodKey, "pro")
        ])

        const usedBasicCredits = events
            .filter((event) => event.counted && event.bucket === "basic")
            .reduce((sum, event) => sum + event.units, 0)
        const effectiveBasicCredits = usedBasicCredits + reservedBasicCredits
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
                used: effectiveBasicCredits,
                remaining: Math.max(0, resolvedAccount.monthlyBasicCredits - effectiveBasicCredits)
            },
            pro: {
                limit: resolvedAccount.monthlyProCredits,
                used: usedProCredits + reservedProCredits,
                remaining: Math.max(
                    0,
                    resolvedAccount.monthlyProCredits - (usedProCredits + reservedProCredits)
                )
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
        const [reservedBasicCredits, reservedProCredits] = await Promise.all([
            getOutstandingReservedUnitsForBucket(
                ctx,
                user.id,
                getCurrentCreditPeriodKey(),
                "basic"
            ),
            getOutstandingReservedUnitsForBucket(ctx, user.id, getCurrentCreditPeriodKey(), "pro")
        ])

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
                used: usedBasicCredits + reservedBasicCredits
            },
            pro: {
                used: usedProCredits + reservedProCredits
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
        const nextAccount = {
            userId: user.id,
            enabled: args.enabled ?? existingAccount?.enabled ?? true,
            plan: args.plan,
            monthlyBasicCredits: args.monthlyBasicCredits ?? existingAccount?.monthlyBasicCredits,
            monthlyProCredits: args.monthlyProCredits ?? existingAccount?.monthlyProCredits,
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

export const upsertUserCreditPlansInternal = internalMutation({
    args: {
        accounts: v.array(
            v.object({
                userId: v.string(),
                plan: v.union(v.literal("free"), v.literal("pro"))
            })
        )
    },
    handler: async (ctx, args) => {
        let created = 0
        let updated = 0

        for (const account of args.accounts) {
            const existingAccount = await getCreditAccount(ctx, account.userId)
            const nextAccount = {
                userId: account.userId,
                enabled: existingAccount?.enabled ?? true,
                plan: account.plan,
                monthlyBasicCredits: existingAccount?.monthlyBasicCredits,
                monthlyProCredits: existingAccount?.monthlyProCredits,
                updatedAt: Date.now()
            }

            if (existingAccount?._id) {
                await ctx.db.patch(existingAccount._id, nextAccount)
                updated += 1
                continue
            }

            await ctx.db.insert("prototypeCreditAccounts", nextAccount)
            created += 1
        }

        return {
            created,
            updated
        }
    }
})

export const upsertUserAccessInternal = internalMutation({
    args: {
        userId: v.string(),
        isStaff: v.optional(v.boolean()),
        bypassLimits: v.optional(v.boolean())
    },
    handler: async (ctx, args) => {
        const existingAccess = await getUserAccess(ctx, args.userId)
        const nextAccess = {
            userId: args.userId,
            isStaff: args.isStaff ?? existingAccess?.isStaff ?? false,
            bypassLimits: args.bypassLimits ?? existingAccess?.bypassLimits ?? false,
            updatedAt: Date.now()
        }

        if (existingAccess?._id) {
            await ctx.db.patch(existingAccess._id, nextAccess)
        } else {
            await ctx.db.insert("userAccess", nextAccess)
        }

        return nextAccess
    }
})

export const consumeCreditForMessage = internalMutation({
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
        counted: v.boolean(),
        requiredPlan: v.optional(v.union(v.literal("free"), v.literal("pro")))
    },
    handler: async (ctx, args) => {
        const { requiredPlan: _requiredPlan, ...eventArgs } = args
        const existing = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserMessageKey", (q) =>
                q.eq("userId", args.userId).eq("messageKey", args.messageKey)
            )
            .first()

        if (existing) {
            return {
                allowed: true,
                bypassed: false,
                existing: true,
                eventId: existing._id
            }
        }

        const access = getResolvedUserAccess(await getUserAccess(ctx, args.userId))
        const account = getResolvedCreditAccount(await getCreditAccount(ctx, args.userId))

        if (args.requiredPlan === "pro" && account.plan !== "pro" && !access.bypassLimits) {
            return {
                allowed: false,
                reason: "plan" as const,
                bypassed: false,
                existing: false,
                plan: account.plan,
                requiredPlan: args.requiredPlan
            }
        }

        if (!args.counted || args.bucket === "none" || args.units <= 0 || access.bypassLimits) {
            const eventId = await ctx.db.insert("prototypeCreditEvents", {
                ...eventArgs,
                periodKey: getCurrentCreditPeriodKey(),
                createdAt: Date.now()
            })

            return {
                allowed: true,
                bypassed: access.bypassLimits,
                existing: false,
                eventId
            }
        }

        const limit =
            args.bucket === "pro" ? account.monthlyProCredits : account.monthlyBasicCredits
        const periodKey = getCurrentCreditPeriodKey()
        const events = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) =>
                q.eq("userId", args.userId).eq("periodKey", periodKey)
            )
            .collect()
        const reservedCredits = await getOutstandingReservedUnitsForBucket(
            ctx,
            args.userId,
            periodKey,
            args.bucket
        )
        const used = events
            .filter((event) => event.counted && event.bucket === args.bucket)
            .reduce((sum, event) => sum + event.units, 0)

        if (used + reservedCredits + args.units > limit) {
            return {
                allowed: false,
                reason: "quota" as const,
                bypassed: false,
                existing: false,
                bucket: args.bucket,
                used: used + reservedCredits,
                limit,
                remaining: Math.max(0, limit - (used + reservedCredits))
            }
        }

        const eventId = await ctx.db.insert("prototypeCreditEvents", {
            ...eventArgs,
            periodKey,
            createdAt: Date.now()
        })

        return {
            allowed: true,
            bypassed: false,
            existing: false,
            eventId
        }
    }
})

export const reserveCreditForMessage = internalMutation({
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
        counted: v.boolean(),
        requiredPlan: v.optional(v.union(v.literal("free"), v.literal("pro")))
    },
    handler: async (ctx, args) => {
        const existingEvent = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserMessageKey", (q) =>
                q.eq("userId", args.userId).eq("messageKey", args.messageKey)
            )
            .first()
        if (existingEvent) {
            return {
                allowed: true,
                bypassed: false,
                existing: true,
                committed: true
            }
        }

        const existingReservation = await getCreditReservation(ctx, args.userId, args.messageKey)
        if (existingReservation?.active) {
            return {
                allowed: true,
                bypassed: false,
                existing: true,
                committed: false
            }
        }

        const access = getResolvedUserAccess(await getUserAccess(ctx, args.userId))
        const account = getResolvedCreditAccount(await getCreditAccount(ctx, args.userId))

        if (args.requiredPlan === "pro" && account.plan !== "pro" && !access.bypassLimits) {
            return {
                allowed: false,
                reason: "plan" as const,
                bypassed: false,
                existing: false,
                plan: account.plan,
                requiredPlan: args.requiredPlan
            }
        }

        const periodKey = getCurrentCreditPeriodKey()
        if (args.counted && args.bucket !== "none" && args.units > 0 && !access.bypassLimits) {
            const limit =
                args.bucket === "pro" ? account.monthlyProCredits : account.monthlyBasicCredits
            const events = await ctx.db
                .query("prototypeCreditEvents")
                .withIndex("byUserPeriod", (q) =>
                    q.eq("userId", args.userId).eq("periodKey", periodKey)
                )
                .collect()
            const used = events
                .filter((event) => event.counted && event.bucket === args.bucket)
                .reduce((sum, event) => sum + event.units, 0)
            const reserved = await getOutstandingReservedUnitsForBucket(
                ctx,
                args.userId,
                periodKey,
                args.bucket
            )

            if (used + reserved + args.units > limit) {
                return {
                    allowed: false,
                    reason: "quota" as const,
                    bypassed: false,
                    existing: false,
                    bucket: args.bucket,
                    used: used + reserved,
                    limit,
                    remaining: Math.max(0, limit - (used + reserved))
                }
            }
        }

        await ctx.db.insert("prototypeCreditReservations", {
            userId: args.userId,
            threadId: args.threadId,
            messageId: args.messageId,
            messageKey: args.messageKey,
            modelId: args.modelId,
            providerSource: args.providerSource,
            feature: args.feature,
            bucket: args.bucket,
            units: args.units,
            counted: args.counted,
            periodKey,
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        })

        return {
            allowed: true,
            bypassed: access.bypassLimits,
            existing: false,
            committed: false
        }
    }
})

export const commitReservedCreditForMessage = internalMutation({
    args: {
        userId: v.string(),
        messageKey: v.string(),
        threadId: v.optional(v.id("threads")),
        messageId: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const existingEvent = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserMessageKey", (q) =>
                q.eq("userId", args.userId).eq("messageKey", args.messageKey)
            )
            .first()
        const reservation = await getCreditReservation(ctx, args.userId, args.messageKey)

        if (existingEvent) {
            if (reservation?.active) {
                await ctx.db.patch(reservation._id, {
                    active: false,
                    finalizedAt: Date.now(),
                    updatedAt: Date.now()
                })
            }

            return {
                committed: true,
                existing: true,
                eventId: existingEvent._id
            }
        }

        if (!reservation || !reservation.active) {
            return {
                committed: false,
                existing: false
            }
        }

        const eventId = await ctx.db.insert("prototypeCreditEvents", {
            userId: reservation.userId,
            threadId: args.threadId ?? reservation.threadId,
            messageId: args.messageId ?? reservation.messageId,
            messageKey: reservation.messageKey,
            modelId: reservation.modelId,
            providerSource: reservation.providerSource,
            feature: reservation.feature,
            bucket: reservation.bucket,
            units: reservation.units,
            counted: reservation.counted,
            periodKey: reservation.periodKey,
            createdAt: Date.now()
        })

        await ctx.db.patch(reservation._id, {
            active: false,
            finalizedAt: Date.now(),
            updatedAt: Date.now()
        })

        return {
            committed: true,
            existing: false,
            eventId
        }
    }
})

export const releaseReservedCreditForMessage = internalMutation({
    args: {
        userId: v.string(),
        messageKey: v.string()
    },
    handler: async (ctx, args) => {
        const reservation = await getCreditReservation(ctx, args.userId, args.messageKey)
        if (!reservation || !reservation.active) {
            return null
        }

        await ctx.db.patch(reservation._id, {
            active: false,
            finalizedAt: Date.now(),
            updatedAt: Date.now()
        })

        return {
            released: true
        }
    }
})

export const reserveToolCallBudget = internalMutation({
    args: {
        userId: v.string(),
        threadId: v.optional(v.id("threads")),
        messageId: v.string(),
        messageKey: v.string(),
        reservedCalls: v.number(),
        reservedBasicCredits: v.number()
    },
    handler: async (ctx, args) => {
        const existing = await getToolCallReservation(ctx, args.userId, args.messageKey)
        if (existing?.active) {
            return {
                allowed: true,
                existing: true,
                bypassed: false,
                reservedCalls: existing.reservedCalls,
                reservedBasicCredits: existing.reservedBasicCredits
            }
        }

        const access = getResolvedUserAccess(await getUserAccess(ctx, args.userId))
        if (access.bypassLimits) {
            return {
                allowed: true,
                existing: false,
                bypassed: true,
                reservedCalls: args.reservedCalls,
                reservedBasicCredits: 0
            }
        }

        const periodKey = getCurrentCreditPeriodKey()

        if (!access.bypassLimits && args.reservedBasicCredits > 0) {
            const account = getResolvedCreditAccount(await getCreditAccount(ctx, args.userId))
            const events = await ctx.db
                .query("prototypeCreditEvents")
                .withIndex("byUserPeriod", (q) =>
                    q.eq("userId", args.userId).eq("periodKey", periodKey)
                )
                .collect()
            const usedBasicCredits = events
                .filter((event) => event.counted && event.bucket === "basic")
                .reduce((sum, event) => sum + event.units, 0)
            const reservedBasicCredits = await getOutstandingReservedUnitsForBucket(
                ctx,
                args.userId,
                periodKey,
                "basic"
            )

            if (
                usedBasicCredits + reservedBasicCredits + args.reservedBasicCredits >
                account.monthlyBasicCredits
            ) {
                return {
                    allowed: false,
                    reason: "quota" as const,
                    used: usedBasicCredits + reservedBasicCredits,
                    limit: account.monthlyBasicCredits,
                    remaining: Math.max(
                        0,
                        account.monthlyBasicCredits - (usedBasicCredits + reservedBasicCredits)
                    )
                }
            }
        }

        await ctx.db.insert("prototypeToolCallReservations", {
            ...args,
            consumedCalls: 0,
            consumedBasicCredits: 0,
            periodKey,
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        })

        return {
            allowed: true,
            existing: false,
            bypassed: false,
            reservedCalls: args.reservedCalls,
            reservedBasicCredits: args.reservedBasicCredits
        }
    }
})

export const consumeReservedToolCall = internalMutation({
    args: {
        userId: v.string(),
        threadId: v.optional(v.id("threads")),
        reservationMessageKey: v.string(),
        messageId: v.string(),
        messageKey: v.string(),
        toolCallId: v.string(),
        toolName: v.string(),
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
        const existingEvent = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserMessageKey", (q) =>
                q.eq("userId", args.userId).eq("messageKey", args.messageKey)
            )
            .first()

        if (existingEvent) {
            return {
                allowed: true,
                existing: true,
                bypassed: false,
                remainingCalls: 0
            }
        }

        const access = getResolvedUserAccess(await getUserAccess(ctx, args.userId))
        if (access.bypassLimits) {
            await ctx.db.insert("prototypeCreditEvents", {
                userId: args.userId,
                threadId: args.threadId,
                messageId: args.messageId,
                messageKey: args.messageKey,
                modelId: args.modelId,
                providerSource: args.providerSource,
                feature: args.feature,
                bucket: args.bucket,
                units: args.units,
                counted: args.counted,
                periodKey: getCurrentCreditPeriodKey(),
                createdAt: Date.now()
            })

            return {
                allowed: true,
                existing: false,
                bypassed: true,
                remainingCalls: null
            }
        }

        const reservation = await getToolCallReservation(
            ctx,
            args.userId,
            args.reservationMessageKey
        )
        if (!reservation || !reservation.active) {
            return {
                allowed: false,
                reason: "budget_exhausted" as const,
                bypassed: false,
                remainingCalls: 0
            }
        }

        const remainingCalls = Math.max(0, reservation.reservedCalls - reservation.consumedCalls)
        if (remainingCalls <= 0) {
            return {
                allowed: false,
                reason: "budget_exhausted" as const,
                bypassed: false,
                remainingCalls: 0
            }
        }

        const nextConsumedCalls = reservation.consumedCalls + 1
        const nextConsumedBasicCredits =
            reservation.consumedBasicCredits +
            (args.counted && args.bucket === "basic" ? args.units : 0)

        await ctx.db.patch(reservation._id, {
            consumedCalls: nextConsumedCalls,
            consumedBasicCredits: nextConsumedBasicCredits,
            updatedAt: Date.now()
        })

        await ctx.db.insert("prototypeCreditEvents", {
            userId: args.userId,
            threadId: args.threadId,
            messageId: args.messageId,
            messageKey: args.messageKey,
            modelId: args.modelId,
            providerSource: args.providerSource,
            feature: args.feature,
            bucket: args.bucket,
            units: args.units,
            counted: args.counted,
            periodKey: getCurrentCreditPeriodKey(),
            createdAt: Date.now()
        })

        return {
            allowed: true,
            existing: false,
            bypassed: false,
            remainingCalls: Math.max(0, reservation.reservedCalls - nextConsumedCalls)
        }
    }
})

export const finalizeToolCallBudget = internalMutation({
    args: {
        userId: v.string(),
        messageKey: v.string()
    },
    handler: async (ctx, args) => {
        const reservation = await getToolCallReservation(ctx, args.userId, args.messageKey)
        if (!reservation || !reservation.active) {
            return null
        }

        const unusedCalls = Math.max(0, reservation.reservedCalls - reservation.consumedCalls)
        const unusedBasicCredits = Math.max(
            0,
            reservation.reservedBasicCredits - reservation.consumedBasicCredits
        )

        await ctx.db.patch(reservation._id, {
            active: false,
            finalizedAt: Date.now(),
            updatedAt: Date.now()
        })

        return {
            unusedCalls,
            unusedBasicCredits
        }
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
