/** The data's own range for a numeric axis, padded when every value is the same. */
export const getBoundedNumericDomain = (values: readonly number[]): [number, number] | null => {
    const finiteValues = values.filter(Number.isFinite)
    if (finiteValues.length === 0) return null

    const minimum = Math.min(...finiteValues)
    const maximum = Math.max(...finiteValues)
    if (minimum !== maximum) return [minimum, maximum]

    const padding = Math.max(Math.abs(minimum) * 0.01, 1)
    const lower = minimum - padding
    const upper = maximum + padding
    return Number.isFinite(lower) && Number.isFinite(upper) ? [lower, upper] : null
}
