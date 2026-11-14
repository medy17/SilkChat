// The user's country, read from the device's time zone. It needs no IP lookup and no
// permission, and unlike the browser language it follows where the device is set up.

type LocaleWithTimeZones = Intl.Locale & {
    getTimeZones?: () => string[] | undefined
    timeZones?: string[]
}

const canonicalTimeZone = (timeZone: string) => {
    try {
        return new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone
    } catch {
        return undefined
    }
}

let countriesByTimeZone: Map<string, string> | undefined

// Engines list a country's time zones but not a time zone's country, so the lookup is
// built once by asking for every possible region code.
const getCountriesByTimeZone = () => {
    if (countriesByTimeZone) return countriesByTimeZone

    countriesByTimeZone = new Map()
    for (let first = 65; first <= 90; first++) {
        for (let second = 65; second <= 90; second++) {
            const country = String.fromCharCode(first, second)
            let timeZones: string[] | undefined
            try {
                const locale = new Intl.Locale(`und-${country}`) as LocaleWithTimeZones
                timeZones = locale.getTimeZones?.() ?? locale.timeZones
            } catch {
                continue
            }
            for (const timeZone of timeZones ?? []) {
                if (!countriesByTimeZone.has(timeZone)) countriesByTimeZone.set(timeZone, country)
            }
        }
    }
    return countriesByTimeZone
}

export const countryForTimeZone = (timeZone: string): string | undefined => {
    const countries = getCountriesByTimeZone()
    const direct = countries.get(timeZone)
    if (direct) return direct

    // Engines disagree on which alias is canonical (Asia/Calcutta and Asia/Kolkata).
    const canonical = canonicalTimeZone(timeZone)
    if (!canonical) return undefined
    for (const [candidate, country] of countries) {
        if (canonicalTimeZone(candidate) === canonical) return country
    }
    return undefined
}

let userCountry: string | undefined | null = null

export const getUserCountry = () => {
    if (userCountry === null) {
        try {
            userCountry = countryForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
        } catch {
            userCountry = undefined
        }
    }
    return userCountry
}
