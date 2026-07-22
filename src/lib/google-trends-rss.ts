export type GoogleTrendingSearch = {
    query: string
    traffic?: number
    publishedAt?: number
}

const decodeXmlEntities = (value: string) =>
    value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
        .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
            String.fromCodePoint(Number.parseInt(code, 16))
        )
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")

const readTag = (xml: string, tag: string) => {
    const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))
    if (!match) return undefined

    const text = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")

    return decodeXmlEntities(text).replace(/\s+/g, " ").trim()
}

const parseTraffic = (value?: string) => {
    if (!value) return undefined
    const amount = Number.parseFloat(value.replace(/[^\d.]/g, ""))
    if (!Number.isFinite(amount)) return undefined
    if (/K/i.test(value)) return amount * 1_000
    if (/M/i.test(value)) return amount * 1_000_000
    if (/B/i.test(value)) return amount * 1_000_000_000
    return amount
}

export const parseGoogleTrendsRss = (xml: string, limit = 10): GoogleTrendingSearch[] => {
    const seen = new Set<string>()
    const trends: GoogleTrendingSearch[] = []

    for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
        const query = readTag(match[1], "title")
        if (!query || query.length > 120) continue

        const dedupeKey = query.toLocaleLowerCase()
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)

        const publishedAtValue = readTag(match[1], "pubDate")
        const publishedAt = publishedAtValue ? Date.parse(publishedAtValue) : Number.NaN
        const traffic = parseTraffic(readTag(match[1], "ht:approx_traffic"))

        trends.push({
            query,
            ...(traffic !== undefined ? { traffic } : {}),
            ...(Number.isFinite(publishedAt) ? { publishedAt } : {})
        })

        if (trends.length >= limit) break
    }

    return trends
}

export const normalizeGoogleTrendsGeo = (value: string) => {
    const normalized = value.trim().toUpperCase()
    return /^[A-Z]{2}$/.test(normalized) ? normalized : "US"
}

export const resolveGoogleTrendsRequestGeo = ({
    vercelCountry,
    fallbackGeo
}: {
    vercelCountry?: string | null
    fallbackGeo?: string | null
}) => normalizeGoogleTrendsGeo(vercelCountry || fallbackGeo || "")
