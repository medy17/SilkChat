import {
    buildTrendingSearchPrompt,
    parseWebTrendSuggestions,
    resolveGoogleTrendsGeo
} from "@/lib/google-trends"
import { describe, expect, it } from "vitest"

describe("Google Trends client helpers", () => {
    it("uses the first browser locale that includes a country", () => {
        expect(resolveGoogleTrendsGeo(["sw", "en-US"])).toBe("TZ")
    })

    it("falls back when browser locales contain no country", () => {
        expect(resolveGoogleTrendsGeo(["en", "sw"])).toBe("US")
    })

    it("turns a trend into a sourced web-search request", () => {
        expect(buildTrendingSearchPrompt("example topic")).toContain(
            "latest reliable information about example topic"
        )
    })

    it("accepts only valid trend records from the server response", () => {
        expect(
            parseWebTrendSuggestions({
                items: [
                    { query: "A trend", traffic: 20_000 },
                    { query: "" },
                    { query: "Wrong traffic", traffic: "lots" }
                ]
            })
        ).toEqual([{ query: "A trend", traffic: 20_000 }])
    })
})
