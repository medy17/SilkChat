import { addUtcMonthsClamped } from "./credits"

export type UsageResetWindow = "five_hour" | "weekly" | "monthly"
export type UsageResetDelivery = "instant" | "banked"
export type UsageResetPlan = "free" | "pro"
export type UsageLimitWindow = "five_hour" | "monthly"

// A weekly reset forgives a quarter of the monthly limit.
export const WEEKLY_RESET_FRACTION = 0.25
// How much of a window must be used before a Banked Reset for it can be used, so one isn't
// wasted with plenty left. Free is lower because one long request is a big slice of its
// small 5-hour window and can be refused well before the limit.
export const USAGE_RESET_USABLE_AT: Record<UsageResetPlan, number> = { free: 0.7, pro: 0.85 }
export const USAGE_RESET_EXPIRY_MONTH_OPTIONS = [1, 3, 6] as const
export const DEFAULT_USAGE_RESET_EXPIRY_MONTHS = 3
export const USAGE_RESET_NOTE_MAX_LENGTH = 200

export type UsageResetEffect = {
    window: UsageResetWindow
    includesFiveHour: boolean
    fraction?: number
}

export type UsageResetGrantLike = UsageResetEffect & {
    scope: "user" | "global"
    userId?: string
    plan?: UsageResetPlan
    signedUpBefore?: number
    delivery: UsageResetDelivery
    expiresAt?: number
    revokedAt?: number
    createdAt: number
}

export type WeeklyBreakpoint = { at: number; fraction: number }

// Usage before a breakpoint stops counting. Weekly breakpoints instead forgive up to
// their fraction of the monthly limit, taken from usage that existed before them.
export type UsageBreakpoints = {
    fiveHourAt?: number
    monthlyAt?: number
    weekly: WeeklyBreakpoint[]
}

export type UsageRecord = { createdAt: number; amountMicrousd: number }

export const EMPTY_USAGE_BREAKPOINTS: UsageBreakpoints = { weekly: [] }

export const resetsFiveHour = (effect: UsageResetEffect) =>
    effect.window === "five_hour" || effect.includesFiveHour

const maxDefined = (left?: number, right?: number) =>
    left === undefined ? right : right === undefined ? left : Math.max(left, right)

export const readAccountBreakpoints = (
    account:
        | {
              usageResetFiveHourAt?: number
              usageResetMonthlyAt?: number
              usageResetWeekly?: WeeklyBreakpoint[]
          }
        | null
        | undefined
): UsageBreakpoints => ({
    fiveHourAt: account?.usageResetFiveHourAt,
    monthlyAt: account?.usageResetMonthlyAt,
    weekly: account?.usageResetWeekly ?? []
})

export const applyResetToBreakpoints = (
    breakpoints: UsageBreakpoints,
    effect: UsageResetEffect,
    at: number
): UsageBreakpoints => ({
    fiveHourAt: resetsFiveHour(effect)
        ? maxDefined(breakpoints.fiveHourAt, at)
        : breakpoints.fiveHourAt,
    monthlyAt:
        effect.window === "monthly" ? maxDefined(breakpoints.monthlyAt, at) : breakpoints.monthlyAt,
    weekly:
        effect.window === "weekly"
            ? [...breakpoints.weekly, { at, fraction: effect.fraction ?? WEEKLY_RESET_FRACTION }]
            : breakpoints.weekly
})

export const mergeBreakpoints = (...all: UsageBreakpoints[]): UsageBreakpoints => ({
    fiveHourAt: all.reduce<number | undefined>(
        (at, next) => maxDefined(at, next.fiveHourAt),
        undefined
    ),
    monthlyAt: all.reduce<number | undefined>(
        (at, next) => maxDefined(at, next.monthlyAt),
        undefined
    ),
    weekly: all.flatMap((breakpoints) => breakpoints.weekly)
})

// Breakpoints from earlier periods no longer matter: those periods' usage isn't counted.
export const pruneBreakpoints = (
    breakpoints: UsageBreakpoints,
    periodStartsAt: number
): UsageBreakpoints => {
    const monthlyAt =
        breakpoints.monthlyAt !== undefined && breakpoints.monthlyAt >= periodStartsAt
            ? breakpoints.monthlyAt
            : undefined
    return {
        fiveHourAt:
            breakpoints.fiveHourAt !== undefined && breakpoints.fiveHourAt >= periodStartsAt
                ? breakpoints.fiveHourAt
                : undefined,
        monthlyAt,
        weekly: breakpoints.weekly.filter(
            (weekly) =>
                weekly.at >= periodStartsAt && (monthlyAt === undefined || weekly.at > monthlyAt)
        )
    }
}

export const computeMonthlyUsedMicrousd = ({
    records,
    carriedMicrousd,
    breakpoints,
    monthlyLimitMicrousd
}: {
    records: UsageRecord[]
    carriedMicrousd: number
    breakpoints: UsageBreakpoints
    monthlyLimitMicrousd: number
}) => {
    const { monthlyAt } = breakpoints
    const counted = records.filter(
        (record) =>
            record.amountMicrousd > 0 && (monthlyAt === undefined || record.createdAt >= monthlyAt)
    )
    // Carried usage predates the account, so a monthly breakpoint always clears it.
    const carried = monthlyAt === undefined ? Math.max(0, carriedMicrousd) : 0
    const total = counted.reduce((sum, record) => sum + record.amountMicrousd, carried)
    const weekly = breakpoints.weekly
        .filter((breakpoint) => monthlyAt === undefined || breakpoint.at > monthlyAt)
        .sort((left, right) => left.at - right.at)

    let forgiven = 0
    for (const breakpoint of weekly) {
        const usedBefore = counted
            .filter((record) => record.createdAt < breakpoint.at)
            .reduce((sum, record) => sum + record.amountMicrousd, carried)
        const allowance = Math.round(Math.max(0, breakpoint.fraction) * monthlyLimitMicrousd)
        forgiven += Math.min(allowance, Math.max(0, usedBefore - forgiven))
    }

    return Math.max(0, total - forgiven)
}

export const isGrantLive = (
    grant: Pick<UsageResetGrantLike, "expiresAt" | "revokedAt">,
    now: number
) => grant.revokedAt === undefined && (grant.expiresAt === undefined || grant.expiresAt > now)

export const grantTargetsUser = (
    grant: Pick<UsageResetGrantLike, "scope" | "userId" | "plan" | "signedUpBefore">,
    user: { userId: string; plan: UsageResetPlan; signedUpAt: number | null }
) => {
    if (grant.scope === "user") return grant.userId === user.userId
    if (grant.plan && grant.plan !== user.plan) return false
    if (grant.signedUpBefore === undefined) return true
    return user.signedUpAt !== null && user.signedUpAt <= grant.signedUpBefore
}

// Which tickets help with a given limit: 5h tickets and bundles for the 5-hour limit,
// weekly and monthly tickets for the monthly one.
export const resetCoversLimit = (effect: UsageResetEffect, limit: UsageLimitWindow) =>
    limit === "five_hour" ? resetsFiveHour(effect) : effect.window !== "five_hour"

const isWindowUsedEnough = (usedMicrousd: number, limitMicrousd: number, threshold: number) =>
    usedMicrousd > 0 && usedMicrousd >= limitMicrousd * threshold

// A Banked Reset is usable once a window it resets is used past the plan's threshold. A
// bundle only needs one of its windows there.
export const isResetUsable = (
    effect: UsageResetEffect,
    plan: UsageResetPlan,
    usage: {
        fiveHourUsedMicrousd: number
        monthlyUsedMicrousd: number
        limits: { fiveHourMicrousd: number; monthlyMicrousd: number }
    }
) => {
    const threshold = USAGE_RESET_USABLE_AT[plan]
    return (
        (resetsFiveHour(effect) &&
            isWindowUsedEnough(
                usage.fiveHourUsedMicrousd,
                usage.limits.fiveHourMicrousd,
                threshold
            )) ||
        (effect.window !== "five_hour" &&
            isWindowUsedEnough(usage.monthlyUsedMicrousd, usage.limits.monthlyMicrousd, threshold))
    )
}

export const getUsageResetExpiresAt = (createdAt: number, expiryMonths: number | null) =>
    expiryMonths === null ? undefined : addUtcMonthsClamped(createdAt, expiryMonths)

export const describeUsageReset = (effect: UsageResetEffect) => {
    const base =
        effect.window === "five_hour"
            ? "5-hour reset"
            : effect.window === "weekly"
              ? "Weekly reset"
              : "Monthly reset"
    return effect.window !== "five_hour" && effect.includesFiveHour ? `${base} + 5-hour` : base
}
