import { v } from "convex/values"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import {
    getAnchoredMonthlyCreditPeriodBounds,
    getConfiguredCreditLimits,
    getCreditPeriodBounds,
    getCreditPeriodKeyFromBounds,
    getCurrentCreditPeriodKey
} from "./lib/credits"
import { getUserIdentity } from "./lib/identity"
import { FIVE_HOURS_MS, getConfiguredHostedUsageLimits, microusdToUsd } from "./lib/usage_metering"

type CreditAccountRecord = {
    _creationTime?: number
    enabled: boolean
    plan: "free" | "pro"
    monthlyBasicCredits?: number
    monthlyProCredits?: number
    creditPeriodAnchorAt?: number
    carriedForPeriodKey?: string
    carriedBasicUnits?: number
    carriedProUnits?: number
    carriedUsageMicrousd?: number
}

type UserAccessRecord = {
    _id?: string
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

const getLatestSubscription = async (ctx: QueryCtx | MutationCtx, userId: string) => {
    const subscriptions = await ctx.db
        .query("lemonSqueezySubscriptions")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .collect()

    return subscriptions.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
}

const parseTimestamp = (value: string | undefined) => {
    if (!value) return null

    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : null
}

export const getUserCreditPeriod = async (
    ctx: QueryCtx | MutationCtx,
    userId: string,
    account: CreditAccountRecord | null | undefined,
    timestamp = Date.now()
) => {
    if (account?.plan === "pro") {
        const subscription = await getLatestSubscription(ctx, userId)
        const renewsAt = parseTimestamp(subscription?.renewsAt)

        if (renewsAt) {
            const bounds = getAnchoredMonthlyCreditPeriodBounds({
                timestamp,
                anchorTimestamp: renewsAt
            })

            return {
                periodKey: getCreditPeriodKeyFromBounds(bounds),
                ...bounds
            }
        }
    }

    const anchorTimestamp = account?.creditPeriodAnchorAt ?? account?._creationTime
    if (anchorTimestamp) {
        const bounds = getAnchoredMonthlyCreditPeriodBounds({
            timestamp,
            anchorTimestamp
        })

        return {
            periodKey: getCreditPeriodKeyFromBounds(bounds),
            ...bounds
        }
    }

    const bounds = getCreditPeriodBounds(timestamp)
    return {
        periodKey: getCurrentCreditPeriodKey(timestamp),
        ...bounds
    }
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

const DEV_CREDIT_LAB_MESSAGE_KEY_PREFIX = "dev-credit-lab:"
const DEV_USAGE_WINDOW_BOUNDARY_MESSAGE_KEY = `${DEV_CREDIT_LAB_MESSAGE_KEY_PREFIX}usage-window:boundary`

// NOTE: Convex runs every deployment (dev, staging, prod) with NODE_ENV === "production"
// in its V8 runtime, so NODE_ENV cannot distinguish environments here. Gate on a dedicated
// env var that is set only on non-production deployments; deny by default.
const assertDevCreditStateRuntime = () => {
    if (process.env.DEV_CREDIT_LAB_ENABLED !== "1") {
        throw new Error("Dev credit state controls are unavailable in production")
    }
}

const getDevCreditPeriodAnchorAt = (
    preset: "default" | "ending_today" | "ending_tomorrow" | undefined,
    now = Date.now()
) => {
    if (!preset) return undefined
    if (preset === "default") return now

    const targetEndsAt =
        preset === "ending_today" ? now + 60 * 60 * 1000 : now + 25 * 60 * 60 * 1000
    const targetEndDate = new Date(targetEndsAt)

    return Date.UTC(
        targetEndDate.getUTCFullYear(),
        targetEndDate.getUTCMonth() - 1,
        targetEndDate.getUTCDate(),
        targetEndDate.getUTCHours(),
        targetEndDate.getUTCMinutes(),
        targetEndDate.getUTCSeconds(),
        targetEndDate.getUTCMilliseconds()
    )
}

const deleteCurrentDevCreditLabEvents = async (
    ctx: MutationCtx,
    userId: string,
    periodKey: string
) => {
    const [events, reservations, toolReservations] = await Promise.all([
        ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
            .collect(),
        ctx.db
            .query("prototypeCreditReservations")
            .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
            .collect(),
        ctx.db
            .query("prototypeToolCallReservations")
            .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
            .collect()
    ])

    await Promise.all(
        [...events, ...reservations, ...toolReservations]
            .filter((row) => row.messageKey.startsWith(DEV_CREDIT_LAB_MESSAGE_KEY_PREFIX))
            .map((row) => ctx.db.delete(row._id))
    )
}

const insertDevCreditLabEvents = async (
    ctx: MutationCtx,
    {
        userId,
        periodKey,
        bucket,
        counted,
        count,
        units = 1,
        providerSource = counted ? "internal" : "byok"
    }: {
        userId: string
        periodKey: string
        bucket: "basic" | "pro" | "none"
        counted: boolean
        count: number
        units?: number
        providerSource?: "internal" | "byok"
    }
) => {
    const safeCount = Math.max(0, Math.floor(count))
    await Promise.all(
        Array.from({ length: safeCount }, async (_, index) => {
            const messageKey = `${DEV_CREDIT_LAB_MESSAGE_KEY_PREFIX}${bucket}:${counted ? "internal" : "byok"}:${index}`
            await ctx.db.insert("prototypeCreditEvents", {
                userId,
                messageId: messageKey,
                messageKey,
                providerSource,
                feature: "chat",
                bucket,
                units,
                counted,
                periodKey,
                createdAt: Date.now() + index
            })
        })
    )
}

const insertDevHostedUsageEvent = async (
    ctx: MutationCtx,
    {
        userId,
        periodKey,
        amountMicrousd,
        createdAt,
        label
    }: {
        userId: string
        periodKey: string
        amountMicrousd: number
        createdAt: number
        label: string
    }
) => {
    const safeAmountMicrousd = Math.max(0, Math.round(amountMicrousd))
    if (safeAmountMicrousd <= 0) return

    const messageKey = `${DEV_CREDIT_LAB_MESSAGE_KEY_PREFIX}usage:${label}`
    await ctx.db.insert("prototypeCreditEvents", {
        userId,
        messageId: messageKey,
        messageKey,
        modelId: "dev-hosted-usage",
        providerSource: "internal",
        feature: "chat",
        bucket: "none",
        units: 0,
        counted: true,
        accountingKind: "usage" as const,
        reservedMicrousd: safeAmountMicrousd,
        settledMicrousd: safeAmountMicrousd,
        pricingSource: "openrouter_reported" as const,
        settledAt: createdAt,
        periodKey,
        createdAt
    })
}

const insertDevHostedUsageWindowBoundary = async (
    ctx: MutationCtx,
    {
        userId,
        periodKey,
        createdAt
    }: {
        userId: string
        periodKey: string
        createdAt: number
    }
) => {
    await ctx.db.insert("prototypeCreditEvents", {
        userId,
        messageId: DEV_USAGE_WINDOW_BOUNDARY_MESSAGE_KEY,
        messageKey: DEV_USAGE_WINDOW_BOUNDARY_MESSAGE_KEY,
        modelId: "dev-hosted-usage",
        providerSource: "internal",
        feature: "chat",
        bucket: "none",
        units: 0,
        counted: false,
        periodKey,
        createdAt
    })
}

const insertDevHostedMonthlyUsage = async (
    ctx: MutationCtx,
    {
        userId,
        periodKey,
        amountMicrousd,
        now
    }: {
        userId: string
        periodKey: string
        amountMicrousd: number
        now: number
    }
) => {
    const safeAmountMicrousd = Math.max(0, Math.round(amountMicrousd))
    if (safeAmountMicrousd <= 0) return

    const chunkCount = Math.min(6, Math.max(1, Math.ceil(safeAmountMicrousd / 1_000_000)))
    const baseAmount = Math.floor(safeAmountMicrousd / chunkCount)
    let remainder = safeAmountMicrousd - baseAmount * chunkCount

    for (let index = 0; index < chunkCount; index++) {
        const amount = baseAmount + (remainder > 0 ? 1 : 0)
        remainder = Math.max(0, remainder - 1)
        await insertDevHostedUsageEvent(ctx, {
            userId,
            periodKey,
            amountMicrousd: amount,
            createdAt: now - (index + 1) * (FIVE_HOURS_MS + 60_000),
            label: `monthly:${index}`
        })
    }
}

export const sumCountedEventUnits = (
    events: Array<{ counted: boolean; bucket: "basic" | "pro" | "none"; units: number }>,
    bucket: "basic" | "pro"
) =>
    events
        .filter((event) => event.counted && event.bucket === bucket)
        .reduce((sum, event) => sum + event.units, 0)

const getCarriedUnitsForPeriod = (
    account: CreditAccountRecord | null | undefined,
    periodKey: string,
    bucket: "basic" | "pro"
) => {
    if (account?.carriedForPeriodKey !== periodKey) return 0

    const carriedUnits = bucket === "basic" ? account.carriedBasicUnits : account.carriedProUnits
    return Math.max(0, carriedUnits ?? 0)
}

const getEffectiveUsedUnits = ({
    account,
    periodKey,
    events,
    reservedUnits,
    bucket
}: {
    account: CreditAccountRecord | null | undefined
    periodKey: string
    events: Array<{ counted: boolean; bucket: "basic" | "pro" | "none"; units: number }>
    reservedUnits: number
    bucket: "basic" | "pro"
}) =>
    sumCountedEventUnits(events, bucket) +
    reservedUnits +
    getCarriedUnitsForPeriod(account, periodKey, bucket)

const getRemainingUnits = (limit: number, used: number) => Math.max(0, limit - used)

// Returns a record that always carries a period anchor, creating the account row if missing.
// Callers must use this record (not the stripped getResolvedCreditAccount output) when computing
// the credit period, otherwise a brand-new account's first event is filed under the calendar-month
// fallback key and orphaned from the anchored period the summary queries read.
const ensureCreditAccountRecord = async (
    ctx: MutationCtx,
    userId: string
): Promise<CreditAccountRecord> => {
    const existingAccount = await getCreditAccount(ctx, userId)
    if (existingAccount) {
        return existingAccount
    }

    const accountAnchorAt = Date.now()
    await ctx.db.insert("prototypeCreditAccounts", {
        userId,
        enabled: true,
        plan: "free",
        creditPeriodAnchorAt: accountAnchorAt,
        updatedAt: accountAnchorAt
    })

    return {
        enabled: true,
        plan: "free",
        creditPeriodAnchorAt: accountAnchorAt
    }
}

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

export const getOutstandingReservedCreditUnits = async (
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

const sumUsageEventMicrousd = (
    events: Array<{
        accountingKind?: "usage"
        settledMicrousd?: number
        reservedMicrousd?: number
    }>
) =>
    events
        .filter((event) => event.accountingKind === "usage")
        .reduce(
            (sum, event) => sum + Math.max(0, event.settledMicrousd ?? event.reservedMicrousd ?? 0),
            0
        )

const sumUsageReservationMicrousd = (
    reservations: Array<{
        active: boolean
        accountingKind?: "usage"
        reservedMicrousd?: number
    }>
) =>
    reservations
        .filter((reservation) => reservation.active && reservation.accountingKind === "usage")
        .reduce((sum, reservation) => sum + Math.max(0, reservation.reservedMicrousd ?? 0), 0)

// Consumed tool calls become usage events, so an active tool budget only
// contributes the not-yet-consumed remainder of its reserve.
const sumToolReservationOutstandingMicrousd = (
    reservations: Array<{
        active: boolean
        reservedMicrousd?: number
        consumedMicrousd?: number
    }>
) =>
    reservations
        .filter((reservation) => reservation.active)
        .reduce(
            (sum, reservation) =>
                sum +
                Math.max(
                    0,
                    (reservation.reservedMicrousd ?? 0) - (reservation.consumedMicrousd ?? 0)
                ),
            0
        )

type UsageWindowRecord = {
    createdAt: number
    amountMicrousd: number
}

const getUsageEventAmountMicrousd = (event: {
    accountingKind?: "usage"
    settledMicrousd?: number
    reservedMicrousd?: number
}) =>
    event.accountingKind === "usage"
        ? Math.max(0, event.settledMicrousd ?? event.reservedMicrousd ?? 0)
        : 0

const getUsageReservationAmountMicrousd = (reservation: {
    active: boolean
    accountingKind?: "usage"
    reservedMicrousd?: number
}) =>
    reservation.active && reservation.accountingKind === "usage"
        ? Math.max(0, reservation.reservedMicrousd ?? 0)
        : 0

const getToolReservationOutstandingMicrousd = (reservation: {
    active: boolean
    reservedMicrousd?: number
    consumedMicrousd?: number
}) =>
    reservation.active
        ? Math.max(0, (reservation.reservedMicrousd ?? 0) - (reservation.consumedMicrousd ?? 0))
        : 0

const getActiveFiveHourUsageWindow = (
    records: UsageWindowRecord[],
    now: number,
    windowBoundaryAt?: number
) => {
    const sortedRecords = records
        .filter(
            (record) =>
                record.amountMicrousd > 0 &&
                record.createdAt <= now &&
                (windowBoundaryAt === undefined || record.createdAt >= windowBoundaryAt)
        )
        .sort((left, right) => left.createdAt - right.createdAt)
    let windowStartsAt: number | null = null

    for (const record of sortedRecords) {
        if (windowStartsAt === null || record.createdAt >= windowStartsAt + FIVE_HOURS_MS) {
            windowStartsAt = record.createdAt
        }
    }

    if (windowStartsAt === null || now >= windowStartsAt + FIVE_HOURS_MS) {
        return {
            usedMicrousd: 0,
            recoversAt: null
        }
    }

    const windowEndsAt = windowStartsAt + FIVE_HOURS_MS
    return {
        usedMicrousd: sortedRecords
            .filter(
                (record) => record.createdAt >= windowStartsAt && record.createdAt < windowEndsAt
            )
            .reduce((sum, record) => sum + record.amountMicrousd, 0),
        recoversAt: windowEndsAt
    }
}

const getHostedUsageState = async (
    ctx: QueryCtx | MutationCtx,
    {
        userId,
        periodKey,
        plan,
        account,
        now = Date.now()
    }: {
        userId: string
        periodKey: string
        plan: "free" | "pro"
        account: CreditAccountRecord | null
        now?: number
    }
) => {
    const [monthlyEvents, monthlyReservations, monthlyToolReservations] = await Promise.all([
        ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
            .collect(),
        ctx.db
            .query("prototypeCreditReservations")
            .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
            .collect(),
        ctx.db
            .query("prototypeToolCallReservations")
            .withIndex("byUserPeriod", (q) => q.eq("userId", userId).eq("periodKey", periodKey))
            .collect()
    ])
    const limits = getConfiguredHostedUsageLimits(plan)
    const carriedUsageMicrousd =
        account?.carriedForPeriodKey === periodKey
            ? Math.max(0, account.carriedUsageMicrousd ?? 0)
            : 0
    const monthlyUsedMicrousd =
        sumUsageEventMicrousd(monthlyEvents) +
        sumUsageReservationMicrousd(monthlyReservations) +
        sumToolReservationOutstandingMicrousd(monthlyToolReservations) +
        carriedUsageMicrousd
    const latestDevUsageWindowBoundary = monthlyEvents
        .filter(
            (event) =>
                event.messageKey === DEV_USAGE_WINDOW_BOUNDARY_MESSAGE_KEY && event.createdAt <= now
        )
        .sort((left, right) => right.createdAt - left.createdAt)[0]
    const activeFiveHourWindow = getActiveFiveHourUsageWindow(
        [
            ...monthlyEvents.map((event) => ({
                createdAt: event.createdAt,
                amountMicrousd: getUsageEventAmountMicrousd(event)
            })),
            ...monthlyReservations.map((reservation) => ({
                createdAt: reservation.createdAt,
                amountMicrousd: getUsageReservationAmountMicrousd(reservation)
            })),
            ...monthlyToolReservations.map((reservation) => ({
                createdAt: reservation.createdAt,
                amountMicrousd: getToolReservationOutstandingMicrousd(reservation)
            }))
        ],
        now,
        latestDevUsageWindowBoundary?.createdAt
    )

    return {
        limits,
        monthlyUsedMicrousd,
        fiveHourUsedMicrousd: activeFiveHourWindow.usedMicrousd,
        fiveHourRemainingMicrousd: Math.max(
            0,
            limits.fiveHourMicrousd - activeFiveHourWindow.usedMicrousd
        ),
        monthlyRemainingMicrousd: Math.max(0, limits.monthlyMicrousd - monthlyUsedMicrousd),
        recoversAt: activeFiveHourWindow.recoversAt
    }
}

const evaluateHostedUsageReservation = async (
    ctx: QueryCtx | MutationCtx,
    {
        userId,
        periodKey,
        periodEndsAt,
        plan,
        account,
        reservedMicrousd
    }: {
        userId: string
        periodKey: string
        periodEndsAt: number
        plan: "free" | "pro"
        account: CreditAccountRecord | null
        reservedMicrousd: number
    }
) => {
    const usage = await getHostedUsageState(ctx, { userId, periodKey, plan, account })
    const exceedsFiveHour =
        usage.fiveHourUsedMicrousd + reservedMicrousd > usage.limits.fiveHourMicrousd
    const exceedsMonthly =
        usage.monthlyUsedMicrousd + reservedMicrousd > usage.limits.monthlyMicrousd

    if (!exceedsFiveHour && !exceedsMonthly) {
        return null
    }

    const window = exceedsFiveHour ? ("five_hour" as const) : ("monthly" as const)
    const usedMicrousd = exceedsFiveHour ? usage.fiveHourUsedMicrousd : usage.monthlyUsedMicrousd
    const limitMicrousd = exceedsFiveHour
        ? usage.limits.fiveHourMicrousd
        : usage.limits.monthlyMicrousd
    return {
        allowed: false as const,
        reason: "usage" as const,
        window,
        bypassed: false,
        existing: false,
        usedUsd: microusdToUsd(usedMicrousd),
        limitUsd: microusdToUsd(limitMicrousd),
        remainingUsd: microusdToUsd(Math.max(0, limitMicrousd - usedMicrousd)),
        recoversAt: window === "five_hour" ? usage.recoversAt : periodEndsAt
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
        const period = await getUserCreditPeriod(ctx, user.id, account)
        const events = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) =>
                q.eq("userId", user.id).eq("periodKey", period.periodKey)
            )
            .collect()
        const [reservedBasicCredits, reservedProCredits] = await Promise.all([
            getOutstandingReservedUnitsForBucket(ctx, user.id, period.periodKey, "basic"),
            getOutstandingReservedUnitsForBucket(ctx, user.id, period.periodKey, "pro")
        ])

        const effectiveBasicCredits = getEffectiveUsedUnits({
            account,
            periodKey: period.periodKey,
            events,
            reservedUnits: reservedBasicCredits,
            bucket: "basic"
        })
        const effectiveProCredits = getEffectiveUsedUnits({
            account,
            periodKey: period.periodKey,
            events,
            reservedUnits: reservedProCredits,
            bucket: "pro"
        })
        const internalRequestCount = events.filter((event) => event.counted).length
        const byokRequestCount = events.filter((event) => !event.counted).length
        const usageLimits = getConfiguredHostedUsageLimits(resolvedAccount.plan)

        return {
            enabled: resolvedAccount.enabled,
            plan: resolvedAccount.plan,
            periodKey: period.periodKey,
            periodStartsAt: period.startsAt,
            periodEndsAt: period.endsAt,
            basic: {
                limit: resolvedAccount.monthlyBasicCredits,
                used: effectiveBasicCredits,
                remaining: getRemainingUnits(
                    resolvedAccount.monthlyBasicCredits,
                    effectiveBasicCredits
                )
            },
            pro: {
                limit: resolvedAccount.monthlyProCredits,
                used: effectiveProCredits,
                remaining: getRemainingUnits(resolvedAccount.monthlyProCredits, effectiveProCredits)
            },
            usageMetering: {
                fiveHourLimitUsd: microusdToUsd(usageLimits.fiveHourMicrousd),
                monthlyLimitUsd: microusdToUsd(usageLimits.monthlyMicrousd)
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
        const account = await getCreditAccount(ctx, userId)
        const period = periodKey
            ? { periodKey, ...getCreditPeriodBounds() }
            : await getUserCreditPeriod(ctx, userId, account)
        const events = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) =>
                q.eq("userId", userId).eq("periodKey", period.periodKey)
            )
            .collect()

        const [reservedBasicCredits, reservedProCredits] = await Promise.all([
            getOutstandingReservedUnitsForBucket(ctx, userId, period.periodKey, "basic"),
            getOutstandingReservedUnitsForBucket(ctx, userId, period.periodKey, "pro")
        ])
        return {
            periodKey: period.periodKey,
            periodStartsAt: period.startsAt,
            periodEndsAt: period.endsAt,
            usedBasicCredits: getEffectiveUsedUnits({
                account,
                periodKey: period.periodKey,
                events,
                reservedUnits: reservedBasicCredits,
                bucket: "basic"
            }),
            usedProCredits: getEffectiveUsedUnits({
                account,
                periodKey: period.periodKey,
                events,
                reservedUnits: reservedProCredits,
                bucket: "pro"
            }),
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

        const account = await getCreditAccount(ctx, user.id)
        const period = await getUserCreditPeriod(ctx, user.id, account)
        const usage = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) =>
                q.eq("userId", user.id).eq("periodKey", period.periodKey)
            )
            .collect()
        const [reservedBasicCredits, reservedProCredits] = await Promise.all([
            getOutstandingReservedUnitsForBucket(ctx, user.id, period.periodKey, "basic"),
            getOutstandingReservedUnitsForBucket(ctx, user.id, period.periodKey, "pro")
        ])
        const resolvedAccount = getResolvedCreditAccount(account)
        const metering = await getHostedUsageState(ctx, {
            userId: user.id,
            periodKey: period.periodKey,
            plan: resolvedAccount.plan,
            account
        })

        return {
            periodKey: period.periodKey,
            periodStartsAt: period.startsAt,
            periodEndsAt: period.endsAt,
            basic: {
                used: getEffectiveUsedUnits({
                    account,
                    periodKey: period.periodKey,
                    events: usage,
                    reservedUnits: reservedBasicCredits,
                    bucket: "basic"
                })
            },
            pro: {
                used: getEffectiveUsedUnits({
                    account,
                    periodKey: period.periodKey,
                    events: usage,
                    reservedUnits: reservedProCredits,
                    bucket: "pro"
                })
            },
            usageMetering: {
                fiveHour: {
                    usedUsd: microusdToUsd(metering.fiveHourUsedMicrousd),
                    remainingUsd: microusdToUsd(metering.fiveHourRemainingMicrousd),
                    recoversAt: metering.recoversAt
                },
                monthly: {
                    usedUsd: microusdToUsd(metering.monthlyUsedMicrousd),
                    remainingUsd: microusdToUsd(metering.monthlyRemainingMicrousd)
                }
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
        await assertAccountNotDeleting(ctx, user.id)

        const existingAccount = await getCreditAccount(ctx, user.id)
        const nextAccount = {
            userId: user.id,
            enabled: args.enabled ?? existingAccount?.enabled ?? true,
            plan: args.plan,
            monthlyBasicCredits: args.monthlyBasicCredits ?? existingAccount?.monthlyBasicCredits,
            monthlyProCredits: args.monthlyProCredits ?? existingAccount?.monthlyProCredits,
            creditPeriodAnchorAt: existingAccount?.creditPeriodAnchorAt ?? Date.now(),
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

export const getMyDevCreditState = query({
    args: {},
    handler: async (ctx) => {
        assertDevCreditStateRuntime()

        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return null
        }

        const [account, access] = await Promise.all([
            getCreditAccount(ctx, user.id),
            getUserAccess(ctx, user.id)
        ])
        const resolvedAccount = getResolvedCreditAccount(account)
        const resolvedAccess = getResolvedUserAccess(access)
        const period = await getUserCreditPeriod(ctx, user.id, account)

        return {
            account: {
                enabled: resolvedAccount.enabled,
                plan: resolvedAccount.plan,
                monthlyBasicCredits: resolvedAccount.monthlyBasicCredits,
                monthlyProCredits: resolvedAccount.monthlyProCredits,
                creditPeriodAnchorAt: account?.creditPeriodAnchorAt ?? null
            },
            access: resolvedAccess,
            period: {
                periodKey: period.periodKey,
                startsAt: period.startsAt,
                endsAt: period.endsAt
            }
        }
    }
})

export const setMyDevCreditState = mutation({
    args: {
        plan: v.optional(v.union(v.literal("free"), v.literal("pro"))),
        monthlyBasicCredits: v.optional(v.number()),
        monthlyProCredits: v.optional(v.number()),
        isStaff: v.optional(v.boolean()),
        bypassLimits: v.optional(v.boolean()),
        usageScenario: v.optional(
            v.union(
                v.literal("normal_empty"),
                v.literal("basic_remaining_zero"),
                v.literal("basic_near_limit"),
                v.literal("pro_remaining_zero"),
                v.literal("pro_near_limit"),
                v.literal("byok_heavy"),
                v.literal("internal_heavy"),
                v.literal("staff_with_limits"),
                v.literal("staff_with_bypass_limits"),
                v.literal("usage_5h_reset"),
                v.literal("usage_5h_near_limit"),
                v.literal("usage_5h_exhausted"),
                v.literal("usage_5h_expired"),
                v.literal("usage_monthly_near_limit"),
                v.literal("usage_monthly_exhausted")
            )
        ),
        periodAnchorPreset: v.optional(
            v.union(v.literal("default"), v.literal("ending_today"), v.literal("ending_tomorrow"))
        )
    },
    handler: async (ctx, args) => {
        assertDevCreditStateRuntime()

        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            throw new Error("Unauthorized")
        }
        await assertAccountNotDeleting(ctx, user.id)

        const now = Date.now()
        const existingAccount = await getCreditAccount(ctx, user.id)
        const existingAccess = await getUserAccess(ctx, user.id)
        const proScenario =
            args.usageScenario === "pro_remaining_zero" || args.usageScenario === "pro_near_limit"
        const basicScenario =
            args.usageScenario === "basic_remaining_zero" ||
            args.usageScenario === "basic_near_limit" ||
            args.usageScenario === "internal_heavy"
        const warnings: string[] = []

        const accountWithRequestedPlan = {
            ...existingAccount,
            enabled: args.plan
                ? (existingAccount?.enabled ?? true)
                : (existingAccount?.enabled ?? true),
            plan: proScenario ? "pro" : (args.plan ?? existingAccount?.plan ?? "free"),
            monthlyBasicCredits: args.monthlyBasicCredits ?? existingAccount?.monthlyBasicCredits,
            monthlyProCredits: args.monthlyProCredits ?? existingAccount?.monthlyProCredits
        } satisfies CreditAccountRecord
        const resolvedRequestedAccount = getResolvedCreditAccount(accountWithRequestedPlan)
        const monthlyBasicCredits =
            basicScenario && resolvedRequestedAccount.monthlyBasicCredits <= 0
                ? 10
                : (args.monthlyBasicCredits ?? existingAccount?.monthlyBasicCredits)
        const monthlyProCredits =
            proScenario && resolvedRequestedAccount.monthlyProCredits <= 0
                ? 5
                : (args.monthlyProCredits ?? existingAccount?.monthlyProCredits)
        const periodAnchorAt =
            getDevCreditPeriodAnchorAt(args.periodAnchorPreset, now) ??
            existingAccount?.creditPeriodAnchorAt ??
            now
        const nextAccount = {
            userId: user.id,
            enabled: existingAccount?.enabled ?? true,
            plan: accountWithRequestedPlan.plan,
            monthlyBasicCredits,
            monthlyProCredits,
            creditPeriodAnchorAt: periodAnchorAt,
            updatedAt: now
        }

        if (args.periodAnchorPreset && nextAccount.plan === "pro") {
            const subscription = await getLatestSubscription(ctx, user.id)
            const renewsAt = parseTimestamp(subscription?.renewsAt)
            if (renewsAt && renewsAt > now) {
                warnings.push("Period is controlled by the active pro subscription renewal date.")
            }
        }

        if (existingAccount?._id) {
            await ctx.db.patch(existingAccount._id, nextAccount)
        } else {
            await ctx.db.insert("prototypeCreditAccounts", nextAccount)
        }

        const scenarioStaff =
            args.usageScenario === "staff_with_limits" ||
            args.usageScenario === "staff_with_bypass_limits"
        const nextAccess = {
            userId: user.id,
            isStaff: scenarioStaff ? true : (args.isStaff ?? existingAccess?.isStaff ?? false),
            bypassLimits:
                args.usageScenario === "staff_with_bypass_limits"
                    ? true
                    : args.usageScenario === "staff_with_limits"
                      ? false
                      : (args.bypassLimits ?? existingAccess?.bypassLimits ?? false),
            updatedAt: now
        }

        if (existingAccess?._id) {
            await ctx.db.patch(existingAccess._id, nextAccess)
        } else {
            await ctx.db.insert("userAccess", nextAccess)
        }

        const period = await getUserCreditPeriod(ctx, user.id, nextAccount)
        if (args.usageScenario) {
            await deleteCurrentDevCreditLabEvents(ctx, user.id, period.periodKey)
        }

        const resolvedAccount = getResolvedCreditAccount(nextAccount)
        const usageLimits = getConfiguredHostedUsageLimits(resolvedAccount.plan)
        if (args.usageScenario?.startsWith("usage_")) {
            await insertDevHostedUsageWindowBoundary(ctx, {
                userId: user.id,
                periodKey: period.periodKey,
                createdAt: now
            })
        }
        switch (args.usageScenario) {
            case "basic_remaining_zero":
                await insertDevCreditLabEvents(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    bucket: "basic",
                    counted: true,
                    count: resolvedAccount.monthlyBasicCredits
                })
                break
            case "basic_near_limit":
                await insertDevCreditLabEvents(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    bucket: "basic",
                    counted: true,
                    count: Math.max(0, resolvedAccount.monthlyBasicCredits - 1)
                })
                break
            case "pro_remaining_zero":
                await insertDevCreditLabEvents(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    bucket: "pro",
                    counted: true,
                    count: resolvedAccount.monthlyProCredits
                })
                break
            case "pro_near_limit":
                await insertDevCreditLabEvents(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    bucket: "pro",
                    counted: true,
                    count: Math.max(0, resolvedAccount.monthlyProCredits - 1)
                })
                break
            case "byok_heavy":
                await insertDevCreditLabEvents(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    bucket: "none",
                    counted: false,
                    count: 8,
                    providerSource: "byok"
                })
                break
            case "internal_heavy":
                await insertDevCreditLabEvents(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    bucket: "basic",
                    counted: true,
                    count: 8,
                    providerSource: "internal"
                })
                break
            case "usage_5h_near_limit":
                await insertDevHostedUsageEvent(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    amountMicrousd: Math.max(0, usageLimits.fiveHourMicrousd - 1_000),
                    createdAt: now,
                    label: "5h:near"
                })
                break
            case "usage_5h_exhausted":
                await insertDevHostedUsageEvent(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    amountMicrousd: usageLimits.fiveHourMicrousd,
                    createdAt: now,
                    label: "5h:exhausted"
                })
                break
            case "usage_5h_expired":
                await insertDevHostedUsageEvent(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    amountMicrousd: Math.floor(usageLimits.fiveHourMicrousd / 2),
                    createdAt: now - FIVE_HOURS_MS - 60_000,
                    label: "5h:expired"
                })
                break
            case "usage_monthly_near_limit":
                await insertDevHostedMonthlyUsage(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    amountMicrousd: Math.max(0, usageLimits.monthlyMicrousd - 1_000),
                    now
                })
                break
            case "usage_monthly_exhausted":
                await insertDevHostedMonthlyUsage(ctx, {
                    userId: user.id,
                    periodKey: period.periodKey,
                    amountMicrousd: usageLimits.monthlyMicrousd,
                    now
                })
                break
        }

        return {
            ok: true,
            account: {
                enabled: resolvedAccount.enabled,
                plan: resolvedAccount.plan,
                monthlyBasicCredits: resolvedAccount.monthlyBasicCredits,
                monthlyProCredits: resolvedAccount.monthlyProCredits,
                creditPeriodAnchorAt: nextAccount.creditPeriodAnchorAt
            },
            access: {
                isStaff: nextAccess.isStaff,
                bypassLimits: nextAccess.bypassLimits
            },
            period: {
                periodKey: period.periodKey,
                startsAt: period.startsAt,
                endsAt: period.endsAt
            },
            warnings
        }
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
                creditPeriodAnchorAt: existingAccount?.creditPeriodAnchorAt ?? Date.now(),
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
        const accountRecord = await ensureCreditAccountRecord(ctx, args.userId)
        const account = getResolvedCreditAccount(accountRecord)
        const period = await getUserCreditPeriod(ctx, args.userId, accountRecord)

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
                periodKey: period.periodKey,
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
        const events = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserPeriod", (q) =>
                q.eq("userId", args.userId).eq("periodKey", period.periodKey)
            )
            .collect()
        const reservedCredits = await getOutstandingReservedUnitsForBucket(
            ctx,
            args.userId,
            period.periodKey,
            args.bucket
        )
        const used = getEffectiveUsedUnits({
            account: accountRecord,
            periodKey: period.periodKey,
            events,
            reservedUnits: reservedCredits,
            bucket: args.bucket
        })

        if (used + args.units > limit) {
            return {
                allowed: false,
                reason: "quota" as const,
                bypassed: false,
                existing: false,
                bucket: args.bucket,
                used,
                limit,
                remaining: getRemainingUnits(limit, used)
            }
        }

        const eventId = await ctx.db.insert("prototypeCreditEvents", {
            ...eventArgs,
            periodKey: period.periodKey,
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
        reservedMicrousd: v.optional(v.number()),
        pricingSource: v.optional(
            v.union(v.literal("openrouter_estimate"), v.literal("fal_manual"))
        ),
        providerRequestId: v.optional(v.string()),
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
        const accountRecord = await ensureCreditAccountRecord(ctx, args.userId)
        const account = getResolvedCreditAccount(accountRecord)
        const period = await getUserCreditPeriod(ctx, args.userId, accountRecord)

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

        const isUsageReservation = args.reservedMicrousd !== undefined
        const reservedMicrousd = Math.max(0, Math.round(args.reservedMicrousd ?? 0))
        if (reservedMicrousd > 0 && args.counted && !access.bypassLimits) {
            const usageBlocked = await evaluateHostedUsageReservation(ctx, {
                userId: args.userId,
                periodKey: period.periodKey,
                periodEndsAt: period.endsAt,
                plan: account.plan,
                account: accountRecord,
                reservedMicrousd
            })
            if (usageBlocked) {
                return usageBlocked
            }
        }

        if (
            !isUsageReservation &&
            args.counted &&
            args.bucket !== "none" &&
            args.units > 0 &&
            !access.bypassLimits
        ) {
            const limit =
                args.bucket === "pro" ? account.monthlyProCredits : account.monthlyBasicCredits
            const events = await ctx.db
                .query("prototypeCreditEvents")
                .withIndex("byUserPeriod", (q) =>
                    q.eq("userId", args.userId).eq("periodKey", period.periodKey)
                )
                .collect()
            const reserved = await getOutstandingReservedUnitsForBucket(
                ctx,
                args.userId,
                period.periodKey,
                args.bucket
            )
            const used = getEffectiveUsedUnits({
                account: accountRecord,
                periodKey: period.periodKey,
                events,
                reservedUnits: reserved,
                bucket: args.bucket
            })

            if (used + args.units > limit) {
                return {
                    allowed: false,
                    reason: "quota" as const,
                    bypassed: false,
                    existing: false,
                    bucket: args.bucket,
                    used,
                    limit,
                    remaining: getRemainingUnits(limit, used)
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
            ...(isUsageReservation
                ? {
                      accountingKind: "usage" as const,
                      reservedMicrousd,
                      pricingSource: args.pricingSource,
                      providerRequestId: args.providerRequestId
                  }
                : {}),
            periodKey: period.periodKey,
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
        messageId: v.optional(v.string()),
        settledMicrousd: v.optional(v.number()),
        pricingSource: v.optional(
            v.union(v.literal("openrouter_reported"), v.literal("fal_reported"))
        ),
        providerRequestId: v.optional(v.string())
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

        const settledAt = Date.now()
        const usageCreatedAt =
            reservation.accountingKind === "usage" ? reservation.createdAt : settledAt
        const settledMicrousd =
            reservation.accountingKind === "usage"
                ? Math.max(0, Math.round(args.settledMicrousd ?? reservation.reservedMicrousd ?? 0))
                : undefined
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
            ...(reservation.accountingKind === "usage"
                ? {
                      accountingKind: "usage" as const,
                      reservedMicrousd: reservation.reservedMicrousd,
                      settledMicrousd,
                      pricingSource: args.pricingSource ?? reservation.pricingSource,
                      providerRequestId: args.providerRequestId ?? reservation.providerRequestId,
                      settledAt
                  }
                : {}),
            periodKey: reservation.periodKey,
            createdAt: usageCreatedAt
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

export const reconcileSettledUsageCost = internalMutation({
    args: {
        userId: v.string(),
        messageKey: v.string(),
        providerRequestId: v.string(),
        settledMicrousd: v.number(),
        pricingSource: v.literal("fal_reported")
    },
    handler: async (ctx, args) => {
        const event = await ctx.db
            .query("prototypeCreditEvents")
            .withIndex("byUserMessageKey", (q) =>
                q.eq("userId", args.userId).eq("messageKey", args.messageKey)
            )
            .first()
        if (!event || event.accountingKind !== "usage") {
            return { reconciled: false }
        }

        const settledMicrousd = Math.max(0, Math.round(args.settledMicrousd))
        await ctx.db.patch(event._id, {
            settledMicrousd,
            pricingSource: args.pricingSource,
            providerRequestId: args.providerRequestId,
            settledAt: Date.now()
        })

        return { reconciled: true, settledMicrousd }
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
        reservedMicrousd: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const existing = await getToolCallReservation(ctx, args.userId, args.messageKey)
        if (existing?.active) {
            return {
                allowed: true,
                existing: true,
                bypassed: false,
                reservedCalls: existing.reservedCalls
            }
        }

        const access = getResolvedUserAccess(await getUserAccess(ctx, args.userId))
        if (access.bypassLimits) {
            return {
                allowed: true,
                existing: false,
                bypassed: true,
                reservedCalls: args.reservedCalls
            }
        }

        const accountRecord = await ensureCreditAccountRecord(ctx, args.userId)
        const account = getResolvedCreditAccount(accountRecord)
        const period = await getUserCreditPeriod(ctx, args.userId, accountRecord)

        const reservedMicrousd = Math.max(0, Math.round(args.reservedMicrousd ?? 0))
        if (reservedMicrousd > 0) {
            const usageBlocked = await evaluateHostedUsageReservation(ctx, {
                userId: args.userId,
                periodKey: period.periodKey,
                periodEndsAt: period.endsAt,
                plan: account.plan,
                account: accountRecord,
                reservedMicrousd
            })
            if (usageBlocked) {
                return usageBlocked
            }
        }

        await ctx.db.insert("prototypeToolCallReservations", {
            userId: args.userId,
            threadId: args.threadId,
            messageId: args.messageId,
            messageKey: args.messageKey,
            reservedCalls: args.reservedCalls,
            consumedCalls: 0,
            reservedBasicCredits: 0,
            consumedBasicCredits: 0,
            reservedMicrousd,
            consumedMicrousd: 0,
            periodKey: period.periodKey,
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        })

        return {
            allowed: true,
            existing: false,
            bypassed: false,
            reservedCalls: args.reservedCalls
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
        counted: v.boolean(),
        chargedMicrousd: v.optional(v.number())
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
            const account = await getCreditAccount(ctx, args.userId)
            const period = await getUserCreditPeriod(ctx, args.userId, account)
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
                periodKey: period.periodKey,
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
        const chargedMicrousd =
            args.counted && args.chargedMicrousd !== undefined
                ? Math.max(0, Math.round(args.chargedMicrousd))
                : 0
        const nextConsumedMicrousd = (reservation.consumedMicrousd ?? 0) + chargedMicrousd

        const consumedAt = Date.now()
        await ctx.db.patch(reservation._id, {
            consumedCalls: nextConsumedCalls,
            consumedMicrousd: nextConsumedMicrousd,
            updatedAt: consumedAt
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
            ...(chargedMicrousd > 0
                ? {
                      accountingKind: "usage" as const,
                      reservedMicrousd: chargedMicrousd,
                      settledMicrousd: chargedMicrousd,
                      pricingSource: "tool_flat" as const,
                      settledAt: consumedAt
                  }
                : {}),
            periodKey: reservation.periodKey,
            createdAt: consumedAt
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

        const account = await getCreditAccount(ctx, args.userId)
        const period = await getUserCreditPeriod(ctx, args.userId, account)

        return await ctx.db.insert("prototypeCreditEvents", {
            ...args,
            periodKey: period.periodKey,
            createdAt: Date.now()
        })
    }
})
