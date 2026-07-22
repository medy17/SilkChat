import { describe, expect, it } from "vitest"
import {
    normalizeGoogleTrendsGeo,
    parseGoogleTrendsRss,
    resolveGoogleTrendsRequestGeo
} from "../../src/lib/google-trends-rss"

describe("Google Trends RSS", () => {
    it("parses, decodes, and deduplicates trend items", () => {
        const xml = `
            <rss xmlns:ht="https://trends.google.com/trending/rss">
                <channel>
                    <item>
                        <title><![CDATA[Silk &amp; search]]></title>
                        <ht:approx_traffic>200K+</ht:approx_traffic>
                        <pubDate>Wed, 22 Jul 2026 04:00:00 -0700</pubDate>
                    </item>
                    <item><title>silk &amp; search</title></item>
                    <item><title>Second topic</title><ht:approx_traffic>1,000+</ht:approx_traffic></item>
                </channel>
            </rss>
        `

        expect(parseGoogleTrendsRss(xml)).toEqual([
            {
                query: "Silk & search",
                traffic: 200_000,
                publishedAt: Date.parse("Wed, 22 Jul 2026 04:00:00 -0700")
            },
            { query: "Second topic", traffic: 1_000 }
        ])
    })

    it("normalizes supported country codes and safely falls back", () => {
        expect(normalizeGoogleTrendsGeo(" tz ")).toBe("TZ")
        expect(normalizeGoogleTrendsGeo("not-a-country")).toBe("US")
    })

    it("prefers Vercel IP country and uses browser inference only as fallback", () => {
        expect(resolveGoogleTrendsRequestGeo({ vercelCountry: "KE", fallbackGeo: "TZ" })).toBe("KE")
        expect(resolveGoogleTrendsRequestGeo({ fallbackGeo: "TZ" })).toBe("TZ")
    })
})
