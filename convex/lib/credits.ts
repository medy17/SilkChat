export type PrototypeCreditPlan = "free" | "pro"
export type PrototypeAccessPlan = PrototypeCreditPlan
export type PrototypeReasoningEffort = "off" | "minimal" | "low" | "medium" | "high"
export type PrototypeReasoningAccessPlanMap = Partial<
    Record<PrototypeReasoningEffort, PrototypeAccessPlan>
>

export const getCurrentCreditPeriodKey = (timestamp = Date.now()) => {
    const date = new Date(timestamp)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
}

export const getCreditPeriodBounds = (timestamp = Date.now()) => {
    const date = new Date(timestamp)
    const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
    const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)
    return {
        startsAt: start,
        endsAt: end
    }
}

const getDaysInUtcMonth = (year: number, monthIndex: number) =>
    new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

const addUtcMonthsClamped = (timestamp: number, months: number) => {
    const date = new Date(timestamp)
    const targetMonthStart = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + months,
        1,
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds()
    )
    const target = new Date(targetMonthStart)
    const day = Math.min(
        date.getUTCDate(),
        getDaysInUtcMonth(target.getUTCFullYear(), target.getUTCMonth())
    )

    return Date.UTC(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        day,
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds()
    )
}

export const getAnchoredMonthlyCreditPeriodBounds = ({
    timestamp = Date.now(),
    anchorTimestamp
}: {
    timestamp?: number
    anchorTimestamp: number
}) => {
    if (!Number.isFinite(anchorTimestamp) || anchorTimestamp <= 0) {
        return getCreditPeriodBounds(timestamp)
    }

    let startsAt = anchorTimestamp

    while (addUtcMonthsClamped(startsAt, 1) <= timestamp) {
        startsAt = addUtcMonthsClamped(startsAt, 1)
    }

    while (startsAt > timestamp) {
        startsAt = addUtcMonthsClamped(startsAt, -1)
    }

    return {
        startsAt,
        endsAt: addUtcMonthsClamped(startsAt, 1)
    }
}

export const getCreditPeriodKeyFromBounds = ({
    startsAt,
    endsAt
}: {
    startsAt: number
    endsAt: number
}) => `${new Date(startsAt).toISOString()}/${new Date(endsAt).toISOString()}`

export const resolveRequiredPlanForModelAccess = ({
    reasoningEffort,
    availableToPickFor,
    availableToPickForReasoningEfforts
}: {
    reasoningEffort: PrototypeReasoningEffort
    availableToPickFor?: PrototypeAccessPlan
    availableToPickForReasoningEfforts?: PrototypeReasoningAccessPlanMap
}): PrototypeAccessPlan => {
    const basePlan = availableToPickFor ?? "pro"
    return availableToPickForReasoningEfforts?.[reasoningEffort] ?? basePlan
}
