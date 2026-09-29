const DAY_MS = 24 * 60 * 60 * 1000
const SOON_DAYS = 7

export type ModelExpiry = { label: string; isSoon: boolean }

// OpenRouter gives a plain YYYY-MM-DD removal date. It's read and formatted as a calendar
// date in UTC, so it never shifts by a day in the viewer's timezone. Past dates return null;
// by then the model shows as retired instead.
export const getModelExpiry = (expirationDate: string, now = Date.now()): ModelExpiry | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expirationDate)
    if (!match) return null

    const endsAt = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    const today = new Date(now)
    const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const daysLeft = Math.round((endsAt - startOfToday) / DAY_MS)

    if (daysLeft < 0) return null
    if (daysLeft === 0) return { label: "Leaves today", isSoon: true }
    if (daysLeft === 1) return { label: "Leaves tomorrow", isSoon: true }
    if (daysLeft <= SOON_DAYS) return { label: `Leaves in ${daysLeft} days`, isSoon: true }

    const date = new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
        ...(new Date(endsAt).getUTCFullYear() !== today.getUTCFullYear()
            ? { year: "numeric" as const }
            : {})
    }).format(endsAt)

    return { label: `Leaves ${date}`, isSoon: false }
}
