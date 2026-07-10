export type PrototypeCreditPlanSummary = {
    enabled: boolean
    plan: "free" | "pro"
    basic: {
        limit: number
    }
    pro: {
        limit: number
    }
    usageMetering?: {
        fiveHourLimitUsd: number
        monthlyLimitUsd: number
    }
}

export type PrototypeCreditUsageSummary = {
    periodKey: string
    periodStartsAt: number
    periodEndsAt: number
    basic: {
        used: number
    }
    pro: {
        used: number
    }
    usageMetering?: {
        fiveHour: {
            usedUsd: number
            remainingUsd: number
            recoversAt: number | null
        }
        monthly: {
            usedUsd: number
            remainingUsd: number
        }
    }
    requestCounts: {
        internal: number
        byok: number
        total: number
    }
}

export type PrototypeCreditSummary = {
    enabled: boolean
    plan: "free" | "pro"
    periodKey: string
    periodStartsAt: number
    periodEndsAt: number
    basic: {
        limit: number
        used: number
        remaining: number
    }
    pro: {
        limit: number
        used: number
        remaining: number
    }
    usageMetering?: {
        fiveHour: {
            limitUsd: number
            usedUsd: number
            remainingUsd: number
            recoversAt: number | null
        }
        monthly: {
            limitUsd: number
            usedUsd: number
            remainingUsd: number
        }
    }
    requestCounts: {
        internal: number
        byok: number
        total: number
    }
}

export type PrototypeCreditDevState = {
    account: {
        enabled: boolean
        plan: "free" | "pro"
        monthlyBasicCredits: number
        monthlyProCredits: number
        creditPeriodAnchorAt: number | null
    }
    access: {
        isStaff: boolean
        bypassLimits: boolean
    }
    period: {
        periodKey: string
        startsAt: number
        endsAt: number
    }
    warnings?: string[]
}

export type PrototypeCreditDevStatePayload = {
    plan?: "free" | "pro"
    monthlyBasicCredits?: number
    monthlyProCredits?: number
    isStaff?: boolean
    bypassLimits?: boolean
    usageScenario?:
        | "normal_empty"
        | "basic_remaining_zero"
        | "basic_near_limit"
        | "pro_remaining_zero"
        | "pro_near_limit"
        | "byok_heavy"
        | "internal_heavy"
        | "staff_with_limits"
        | "staff_with_bypass_limits"
    periodAnchorPreset?: "default" | "ending_today" | "ending_tomorrow"
}

export type CachedPrototypeCreditValue<T> = {
    value: T
    savedAt: number
}

export function buildPrototypeCreditSummary(
    planSummary: PrototypeCreditPlanSummary,
    usageSummary: PrototypeCreditUsageSummary
): PrototypeCreditSummary {
    return {
        enabled: planSummary.enabled,
        plan: planSummary.plan,
        periodKey: usageSummary.periodKey,
        periodStartsAt: usageSummary.periodStartsAt,
        periodEndsAt: usageSummary.periodEndsAt,
        basic: {
            limit: planSummary.basic.limit,
            used: usageSummary.basic.used,
            remaining: Math.max(0, planSummary.basic.limit - usageSummary.basic.used)
        },
        pro: {
            limit: planSummary.pro.limit,
            used: usageSummary.pro.used,
            remaining: Math.max(0, planSummary.pro.limit - usageSummary.pro.used)
        },
        ...(planSummary.usageMetering && usageSummary.usageMetering
            ? {
                  usageMetering: {
                      fiveHour: {
                          limitUsd: planSummary.usageMetering.fiveHourLimitUsd,
                          ...usageSummary.usageMetering.fiveHour
                      },
                      monthly: {
                          limitUsd: planSummary.usageMetering.monthlyLimitUsd,
                          ...usageSummary.usageMetering.monthly
                      }
                  }
              }
            : {}),
        requestCounts: usageSummary.requestCounts
    }
}

export function isPrototypeCreditCacheStale(savedAt: number, maxAgeMs: number) {
    if (!savedAt) {
        return true
    }

    return Date.now() - savedAt > maxAgeMs
}

export function readCachedPrototypeCreditValue<T>(
    key: string
): CachedPrototypeCreditValue<T> | null {
    if (typeof window === "undefined") {
        return null
    }

    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
        return null
    }

    try {
        const parsed = JSON.parse(rawValue) as CachedPrototypeCreditValue<T>
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("value" in parsed) ||
            !("savedAt" in parsed)
        ) {
            return null
        }

        return parsed
    } catch {
        return null
    }
}

export function writeCachedPrototypeCreditValue<T>(key: string, value: T) {
    if (typeof window === "undefined") {
        return
    }

    const payload: CachedPrototypeCreditValue<T> = {
        value,
        savedAt: Date.now()
    }

    window.localStorage.setItem(key, JSON.stringify(payload))
}
