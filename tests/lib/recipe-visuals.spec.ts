import { parseBraveImageResults } from "@/lib/brave-image-search"
import { buildBraveImageSearchUrl } from "@/lib/recipe-visuals"
import { describe, expect, it } from "vitest"

const result = (overrides: Record<string, unknown> = {}) => ({
    title: "Wrapping shuwa in banana leaves",
    url: "https://example.com/shuwa-recipe",
    source: "example.com",
    confidence: "high",
    properties: { url: "https://cdn.example.com/shuwa.jpg" },
    ...overrides
})

describe("recipe visual search", () => {
    it("builds a bounded same-origin search URL", () => {
        const url = new URL(
            buildBraveImageSearchUrl("wrapping shuwa & leaves", 20, "step"),
            "https://silkchat.com"
        )

        expect(url.origin).toBe("https://silkchat.com")
        expect(url.pathname).toBe("/api/recipe-visuals")
        expect(url.searchParams.get("q")).toBe("wrapping shuwa & leaves")
        expect(url.searchParams.get("limit")).toBe("3")
        expect(url.searchParams.get("variant")).toBe("step")
    })

    it("uses stricter confidence gating for step visuals", () => {
        const payload = {
            results: [
                result(),
                result({
                    title: "A loosely related dish",
                    confidence: "medium",
                    properties: { url: "https://cdn.example.com/medium.jpg" }
                })
            ],
            extra: { might_be_offensive: false }
        }

        expect(parseBraveImageResults(payload, "step", 3)).toHaveLength(1)
        expect(parseBraveImageResults(payload, "gallery", 3)).toHaveLength(2)
    })

    it("rejects offensive results and unsafe asset or source links", () => {
        expect(
            parseBraveImageResults(
                { results: [result()], extra: { might_be_offensive: true } },
                "gallery",
                3
            )
        ).toEqual([])

        expect(
            parseBraveImageResults(
                {
                    results: [
                        result({ properties: { url: "http://cdn.example.com/image.jpg" } }),
                        result({ url: "javascript:alert(1)" })
                    ]
                },
                "gallery",
                3
            )
        ).toEqual([])
    })
})
