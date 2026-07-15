export type HostedUsagePlan = "free" | "pro"

export const MICROUSD_PER_USD = 1_000_000
export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000

const DEFAULT_LIMITS_USD: Record<HostedUsagePlan, { fiveHour: number; monthly: number }> = {
    free: { fiveHour: 0.1, monthly: 0.5 },
    pro: { fiveHour: 1, monthly: 18 }
}

const parseNonNegativeNumber = (value: string | undefined, fallback: number) => {
    if (value === undefined || value.trim() === "") return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const parseBooleanFlag = (value: string | undefined) =>
    value === "1" || value?.toLowerCase() === "true"

export const usdToMicrousd = (usd: number) =>
    Number.isFinite(usd) && usd > 0 ? Math.max(0, Math.round(usd * MICROUSD_PER_USD)) : 0

export const microusdToUsd = (microusd: number) =>
    Number.isFinite(microusd) && microusd > 0 ? microusd / MICROUSD_PER_USD : 0

export const getConfiguredHostedUsageLimits = (plan: HostedUsagePlan) => {
    const suffix = plan.toUpperCase()
    const defaults = DEFAULT_LIMITS_USD[plan]
    const fiveHourUsd = parseNonNegativeNumber(
        process.env[`HOSTED_USAGE_5H_USD_${suffix}`],
        defaults.fiveHour
    )
    const monthlyUsd = parseNonNegativeNumber(
        process.env[`HOSTED_USAGE_MONTHLY_USD_${suffix}`],
        defaults.monthly
    )

    return {
        fiveHourMicrousd: usdToMicrousd(fiveHourUsd),
        monthlyMicrousd: usdToMicrousd(monthlyUsd)
    }
}

export const getConfiguredOutputReservationTokens = () =>
    Math.max(
        0,
        Math.floor(parseNonNegativeNumber(process.env.HOSTED_USAGE_OUTPUT_RESERVE_TOKENS, 4096))
    )

export const estimateOpenRouterReservationMicrousd = ({
    estimatedInputTokens,
    maxOutputTokens,
    inputUsdPer1MTokens,
    outputUsdPer1MTokens
}: {
    estimatedInputTokens: number
    maxOutputTokens: number
    inputUsdPer1MTokens?: number
    outputUsdPer1MTokens?: number
}) => {
    const fallbackInputPrice = parseNonNegativeNumber(
        process.env.HOSTED_USAGE_UNKNOWN_INPUT_USD_PER_1M,
        10
    )
    const fallbackOutputPrice = parseNonNegativeNumber(
        process.env.HOSTED_USAGE_UNKNOWN_OUTPUT_USD_PER_1M,
        30
    )
    const inputPrice = inputUsdPer1MTokens ?? fallbackInputPrice
    const outputPrice = outputUsdPer1MTokens ?? fallbackOutputPrice
    const outputTokens = Math.min(
        Math.max(0, maxOutputTokens),
        getConfiguredOutputReservationTokens()
    )
    const estimatedUsd =
        (Math.max(0, estimatedInputTokens) * inputPrice + outputTokens * outputPrice) / 1_000_000

    return usdToMicrousd(estimatedUsd)
}

// Flat per-call upstream cost for deployment-funded tools. Only tools with a
// non-zero default (or an env override) are metered; everything else is BYOK.
const DEFAULT_TOOL_USAGE_USD: Record<string, number> = {
    web_search: 0.005
}

export const getConfiguredToolUsageMicrousd = (toolName: string) => {
    const normalizedTool = toolName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    const usd = parseNonNegativeNumber(
        process.env[`TOOL_USAGE_USD_${normalizedTool}`],
        DEFAULT_TOOL_USAGE_USD[toolName] ?? 0
    )
    return usdToMicrousd(usd)
}

export const getConfiguredFalReservationMicrousd = ({
    modelId,
    resolution
}: {
    modelId: string
    resolution?: string
}) => {
    const normalizedModel = modelId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    const modelOverride = process.env[`FAL_USAGE_RESERVATION_USD_${normalizedModel}`]
    const baseUsd = parseNonNegativeNumber(
        modelOverride ?? process.env.FAL_USAGE_RESERVATION_USD_DEFAULT,
        0.005
    )
    const multiplier = resolution === "4K" ? 2 : resolution === "2K" ? 1.5 : 1
    return usdToMicrousd(baseUsd * multiplier)
}

export const isFalPricingEstimateEnabled = () =>
    parseBooleanFlag(process.env.FAL_USAGE_PRICING_ESTIMATE_ENABLED)

export const resolveFalBillingEventMicrousd = (
    payload: unknown,
    requestId: string
): number | undefined => {
    if (!payload || typeof payload !== "object" || !("billing_events" in payload)) {
        return undefined
    }
    const events = payload.billing_events
    if (!Array.isArray(events)) return undefined

    for (const event of events) {
        if (!event || typeof event !== "object") continue
        const record = event as Record<string, unknown>
        if (record.request_id !== requestId) continue
        const nanoUsd =
            typeof record.cost_estimate_nano_usd === "string"
                ? Number(record.cost_estimate_nano_usd)
                : record.cost_estimate_nano_usd
        if (typeof nanoUsd === "number" && Number.isFinite(nanoUsd) && nanoUsd >= 0) {
            return Math.max(0, Math.round(nanoUsd / 1000))
        }
    }

    return undefined
}

export const resolveFalEstimateMicrousd = (payload: unknown): number | undefined => {
    if (!payload || typeof payload !== "object") return undefined
    const record = payload as Record<string, unknown>
    if (record.currency !== "USD") return undefined
    const totalCost =
        typeof record.total_cost === "string" ? Number(record.total_cost) : record.total_cost
    if (typeof totalCost !== "number" || !Number.isFinite(totalCost) || totalCost <= 0) {
        return undefined
    }
    return usdToMicrousd(totalCost)
}
